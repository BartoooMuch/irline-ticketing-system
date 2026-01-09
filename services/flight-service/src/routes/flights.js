const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { verifyToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Cache TTL in seconds
const CACHE_TTL = 300; // 5 minutes

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array(),
      },
    });
  }
  next();
};

/**
 * @route   POST /api/v1/flights
 * @desc    Add a new flight (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/',
  verifyToken,
  // requireAdmin, // TODO: Enable in production
  [
    body('flightCode').notEmpty().isLength({ min: 3, max: 10 }),
    body('fromAirportCode').notEmpty().isLength({ min: 3, max: 3 }),
    body('toAirportCode').notEmpty().isLength({ min: 3, max: 3 }),
    body('departureDate').isISO8601(),
    body('departureTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('arrivalTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('durationMinutes').isInt({ min: 1 }),
    body('price').optional().isFloat({ min: 0 }),
    body('capacity').isInt({ min: 1, max: 500 }),
    body('isDirect').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    const {
      flightCode,
      fromAirportCode,
      toAirportCode,
      departureDate,
      departureTime,
      arrivalTime,
      durationMinutes,
      price,
      capacity,
      isDirect = true,
    } = req.body;

    try {
      // Get airport IDs
      const fromAirport = await req.db.query(
        'SELECT id FROM airports WHERE code = $1',
        [fromAirportCode.toUpperCase()]
      );
      
      const toAirport = await req.db.query(
        'SELECT id FROM airports WHERE code = $1',
        [toAirportCode.toUpperCase()]
      );

      if (fromAirport.rows.length === 0 || toAirport.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid airport code',
            code: 'INVALID_AIRPORT',
          },
        });
      }

      // Get price prediction if no price provided
      let finalPrice = price;
      if (!finalPrice) {
        try {
          const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';
          const prediction = await axios.post(`${mlServiceUrl}/predict`, {
            fromAirport: fromAirportCode,
            toAirport: toAirportCode,
            departureDate,
            durationMinutes,
          });
          finalPrice = prediction.data.predictedPrice;
          logger.info(`Price predicted: ${finalPrice} for ${fromAirportCode}-${toAirportCode}`);
        } catch (error) {
          logger.warn('ML prediction failed, using default price');
          finalPrice = 150 + Math.random() * 350; // Default price range
        }
      }

      // Get default airline (Turkish Airlines)
      const airline = await req.db.query(
        "SELECT id FROM airlines WHERE code = 'TK' LIMIT 1"
      );

      // Insert flight
      const result = await req.db.query(
        `INSERT INTO flights (
          id, flight_code, airline_id, from_airport_id, to_airport_id,
          departure_date, departure_time, arrival_time, duration_minutes,
          base_price, total_capacity, available_capacity, is_direct, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          uuidv4(),
          flightCode.toUpperCase(),
          airline.rows[0]?.id,
          fromAirport.rows[0].id,
          toAirport.rows[0].id,
          departureDate,
          departureTime,
          arrivalTime,
          durationMinutes,
          finalPrice,
          capacity,
          capacity,
          isDirect,
          req.user.id,
        ]
      );

      // Invalidate cache
      if (req.redis) {
        const cacheKey = `flights:${fromAirportCode}:${toAirportCode}:${departureDate}`;
        await req.redis.del(cacheKey);
      }

      logger.info(`Flight created: ${flightCode} by admin ${req.user.email}`);

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/flights/search
 * @desc    Search for flights
 * @access  Public
 */
router.get(
  '/search',
  optionalAuth,
  [
    query('from').notEmpty().isLength({ min: 3, max: 3 }),
    query('to').notEmpty().isLength({ min: 3, max: 3 }),
    query('date').isISO8601(),
    query('passengers').optional().isInt({ min: 1, max: 9 }),
    query('flexibleDates').optional().isBoolean(),
    query('directOnly').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  async (req, res, next) => {
    const {
      from,
      to,
      date,
      passengers = 1,
      flexibleDates = false,
      directOnly = false,
      page = 1,
      limit = 10,
    } = req.query;

    const offset = (page - 1) * limit;
    const passengerCount = parseInt(passengers);

    try {
      // Try to get from cache first
      const cacheKey = `flights:search:${from}:${to}:${date}:${passengers}:${flexibleDates}:${directOnly}:${page}`;
      
      if (req.redis) {
        const cached = await req.redis.get(cacheKey);
        if (cached) {
          logger.info('Flight search served from cache');
          return res.json(JSON.parse(cached));
        }
      }

      // Build date condition for flexible dates
      let dateCondition = 'f.departure_date = $3';
      let dateParams = [date];
      
      if (flexibleDates === 'true' || flexibleDates === true) {
        dateCondition = 'f.departure_date BETWEEN $3::date - INTERVAL \'3 days\' AND $3::date + INTERVAL \'3 days\'';
      }

      // Build direct flight condition
      let directCondition = '';
      if (directOnly === 'true' || directOnly === true) {
        directCondition = 'AND f.is_direct = TRUE';
      }

      // Search query
      const searchQuery = `
        SELECT 
          f.id,
          f.flight_code,
          f.departure_date,
          f.departure_time,
          f.arrival_time,
          f.duration_minutes,
          f.base_price,
          f.available_capacity,
          f.is_direct,
          f.status,
          fa.code as from_airport_code,
          fa.name as from_airport_name,
          fa.city as from_city,
          ta.code as to_airport_code,
          ta.name as to_airport_name,
          ta.city as to_city,
          al.code as airline_code,
          al.name as airline_name
        FROM flights f
        JOIN airports fa ON f.from_airport_id = fa.id
        JOIN airports ta ON f.to_airport_id = ta.id
        LEFT JOIN airlines al ON f.airline_id = al.id
        WHERE fa.code = $1
          AND ta.code = $2
          AND ${dateCondition}
          AND f.available_capacity >= $4
          AND f.status = 'SCHEDULED'
          ${directCondition}
        ORDER BY f.departure_date, f.departure_time
        LIMIT $5 OFFSET $6
      `;

      const result = await req.db.query(searchQuery, [
        from.toUpperCase(),
        to.toUpperCase(),
        date,
        passengerCount,
        parseInt(limit),
        offset,
      ]);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM flights f
        JOIN airports fa ON f.from_airport_id = fa.id
        JOIN airports ta ON f.to_airport_id = ta.id
        WHERE fa.code = $1
          AND ta.code = $2
          AND ${dateCondition}
          AND f.available_capacity >= $4
          AND f.status = 'SCHEDULED'
          ${directCondition}
      `;

      const countResult = await req.db.query(countQuery, [
        from.toUpperCase(),
        to.toUpperCase(),
        date,
        passengerCount,
      ]);

      const response = {
        success: true,
        data: {
          flights: result.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(countResult.rows[0].total),
            totalPages: Math.ceil(countResult.rows[0].total / limit),
          },
          searchParams: {
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            date,
            passengers: passengerCount,
            flexibleDates,
            directOnly,
          },
        },
      };

      // Cache the response
      if (req.redis) {
        await req.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
      }

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/flights/:id
 * @desc    Get flight by ID
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await req.db.query(
      `SELECT 
        f.*,
        fa.code as from_airport_code,
        fa.name as from_airport_name,
        fa.city as from_city,
        ta.code as to_airport_code,
        ta.name as to_airport_name,
        ta.city as to_city,
        al.code as airline_code,
        al.name as airline_name
      FROM flights f
      JOIN airports fa ON f.from_airport_id = fa.id
      JOIN airports ta ON f.to_airport_id = ta.id
      LEFT JOIN airlines al ON f.airline_id = al.id
      WHERE f.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Flight not found',
          code: 'NOT_FOUND',
        },
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/v1/flights/:id
 * @desc    Update flight (Admin only)
 * @access  Private (Admin)
 */
router.put(
  '/:id',
  verifyToken,
  // requireAdmin, // TODO: Enable in production
  [
    body('price').optional().isFloat({ min: 0 }),
    body('capacity').optional().isInt({ min: 1 }),
    body('status').optional().isIn(['SCHEDULED', 'CANCELLED', 'DELAYED', 'COMPLETED']),
  ],
  validate,
  async (req, res, next) => {
    const { id } = req.params;
    const { price, capacity, status } = req.body;

    try {
      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (price !== undefined) {
        updates.push(`base_price = $${paramIndex++}`);
        values.push(price);
      }
      if (capacity !== undefined) {
        updates.push(`total_capacity = $${paramIndex++}`);
        updates.push(`available_capacity = $${paramIndex++}`);
        values.push(capacity);
        values.push(capacity);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'No fields to update',
            code: 'NO_UPDATES',
          },
        });
      }

      values.push(id);

      const result = await req.db.query(
        `UPDATE flights SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Flight not found',
            code: 'NOT_FOUND',
          },
        });
      }

      logger.info(`Flight ${id} updated by admin ${req.user.email}`);

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/flights/admin/list
 * @desc    Get all flights for admin (with filters)
 * @access  Private (Admin)
 */
router.get(
  '/admin/list',
  verifyToken,
  // requireAdmin, // TODO: Enable in production
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['SCHEDULED', 'CANCELLED', 'DELAYED', 'COMPLETED']),
    query('date').optional().isISO8601(),
  ],
  validate,
  async (req, res, next) => {
    const { page = 1, limit = 20, status, date } = req.query;
    const offset = (page - 1) * limit;

    try {
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      if (status) {
        whereConditions.push(`f.status = $${paramIndex++}`);
        params.push(status);
      }
      if (date) {
        whereConditions.push(`f.departure_date = $${paramIndex++}`);
        params.push(date);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      const result = await req.db.query(
        `SELECT 
          f.*,
          fa.code as from_airport_code,
          ta.code as to_airport_code,
          al.name as airline_name
        FROM flights f
        JOIN airports fa ON f.from_airport_id = fa.id
        JOIN airports ta ON f.to_airport_id = ta.id
        LEFT JOIN airlines al ON f.airline_id = al.id
        ${whereClause}
        ORDER BY f.departure_date DESC, f.departure_time
        LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, parseInt(limit), offset]
      );

      const countResult = await req.db.query(
        `SELECT COUNT(*) as total FROM flights f ${whereClause}`,
        params
      );

      res.json({
        success: true,
        data: {
          flights: result.rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(countResult.rows[0].total),
            totalPages: Math.ceil(countResult.rows[0].total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
