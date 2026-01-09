const express = require('express');
const { query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();

// Cache TTL in seconds (airports change infrequently, so 1 hour cache)
const CACHE_TTL = 3600;

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
 * @route   GET /api/v1/airports
 * @desc    Get all airports (cached)
 * @access  Public
 */
router.get(
  '/',
  [
    query('search').optional().trim(),
    query('country').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    const { search, country } = req.query;
    const cacheKey = `airports:list:${search || ''}:${country || ''}`;

    try {
      // Try to get from cache
      if (req.redis) {
        const cached = await req.redis.get(cacheKey);
        if (cached) {
          logger.info('Airports served from cache');
          return res.json(JSON.parse(cached));
        }
      }

      // Build query
      let queryText = 'SELECT * FROM airports WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (search) {
        queryText += ` AND (
          code ILIKE $${paramIndex} OR 
          name ILIKE $${paramIndex} OR 
          city ILIKE $${paramIndex}
        )`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (country) {
        queryText += ` AND country = $${paramIndex}`;
        params.push(country);
        paramIndex++;
      }

      queryText += ' ORDER BY country, city, name';

      const result = await req.db.query(queryText, params);

      const response = {
        success: true,
        data: {
          airports: result.rows,
          total: result.rows.length,
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
 * @route   GET /api/v1/airports/:code
 * @desc    Get airport by code (cached)
 * @access  Public
 */
router.get('/:code', async (req, res, next) => {
  const { code } = req.params;
  const cacheKey = `airport:${code.toUpperCase()}`;

  try {
    // Try to get from cache
    if (req.redis) {
      const cached = await req.redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    const result = await req.db.query(
      'SELECT * FROM airports WHERE code = $1',
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Airport not found',
          code: 'NOT_FOUND',
        },
      });
    }

    const response = {
      success: true,
      data: result.rows[0],
    };

    // Cache the response
    if (req.redis) {
      await req.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/airports/destinations/:fromCode
 * @desc    Get available destinations from an airport (cached)
 * @access  Public
 */
router.get('/destinations/:fromCode', async (req, res, next) => {
  const { fromCode } = req.params;
  const cacheKey = `airport:destinations:${fromCode.toUpperCase()}`;

  try {
    // Try to get from cache
    if (req.redis) {
      const cached = await req.redis.get(cacheKey);
      if (cached) {
        logger.info('Destinations served from cache');
        return res.json(JSON.parse(cached));
      }
    }

    // Get all destinations that have flights from this airport
    const result = await req.db.query(
      `SELECT DISTINCT 
        a.id,
        a.code,
        a.name,
        a.city,
        a.country
      FROM airports a
      JOIN flights f ON f.to_airport_id = a.id
      JOIN airports fa ON f.from_airport_id = fa.id
      WHERE fa.code = $1
        AND f.status = 'SCHEDULED'
        AND f.departure_date >= CURRENT_DATE
      ORDER BY a.country, a.city`,
      [fromCode.toUpperCase()]
    );

    const response = {
      success: true,
      data: {
        from: fromCode.toUpperCase(),
        destinations: result.rows,
        total: result.rows.length,
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
});

/**
 * @route   GET /api/v1/airports/search/autocomplete
 * @desc    Autocomplete search for airports (cached)
 * @access  Public
 */
router.get('/search/autocomplete', async (req, res, next) => {
  const { q } = req.query;

  if (!q || q.length < 2) {
    return res.json({
      success: true,
      data: {
        suggestions: [],
      },
    });
  }

  const cacheKey = `airport:autocomplete:${q.toLowerCase()}`;

  try {
    // Try to get from cache
    if (req.redis) {
      const cached = await req.redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    const result = await req.db.query(
      `SELECT code, name, city, country
       FROM airports
       WHERE code ILIKE $1 
          OR name ILIKE $1 
          OR city ILIKE $1
       ORDER BY 
         CASE 
           WHEN code ILIKE $2 THEN 1
           WHEN city ILIKE $2 THEN 2
           ELSE 3
         END,
         city
       LIMIT 10`,
      [`%${q}%`, `${q}%`]
    );

    const response = {
      success: true,
      data: {
        suggestions: result.rows.map((row) => ({
          code: row.code,
          name: row.name,
          city: row.city,
          country: row.country,
          label: `${row.city} (${row.code}) - ${row.name}`,
        })),
      },
    };

    // Cache the response (shorter TTL for autocomplete)
    if (req.redis) {
      await req.redis.setEx(cacheKey, 300, JSON.stringify(response));
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
