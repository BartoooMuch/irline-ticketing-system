const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

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

// Generate booking reference
const generateBookingRef = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Generate ticket number
const generateTicketNumber = () => {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TK${date}${random}`;
};

// Calculate miles earned (10 miles per $1 spent)
const calculateMilesEarned = (price) => {
  return Math.floor(price * 10);
};

/**
 * @route   POST /api/v1/tickets/buy
 * @desc    Buy ticket(s) for a flight
 * @access  Public (optional auth for MilesSmiles members)
 */
router.post(
  '/buy',
  optionalAuth,
  [
    body('flightId').isUUID(),
    body('passengers').isArray({ min: 1, max: 9 }),
    body('passengers.*.firstName').notEmpty().trim(),
    body('passengers.*.lastName').notEmpty().trim(),
    body('passengers.*.title').isIn(['Mr', 'Ms', 'Mrs', 'Miss']),
    body('passengers.*.dateOfBirth').isISO8601(),
    body('passengers.*.email').optional().isEmail(),
    body('passengers.*.phone').optional(),
    body('useMiles').optional().isBoolean(),
    body('memberNumber').optional(),
  ],
  validate,
  async (req, res, next) => {
    const { flightId, passengers, useMiles = false, memberNumber } = req.body;
    const client = await req.db.connect();

    try {
      await client.query('BEGIN');

      // Get flight details and lock row
      const flightResult = await client.query(
        `SELECT f.*, fa.code as from_code, ta.code as to_code
         FROM flights f
         JOIN airports fa ON f.from_airport_id = fa.id
         JOIN airports ta ON f.to_airport_id = ta.id
         WHERE f.id = $1 
         FOR UPDATE`,
        [flightId]
      );

      if (flightResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: { message: 'Flight not found', code: 'FLIGHT_NOT_FOUND' },
        });
      }

      const flight = flightResult.rows[0];

      // Check if enough capacity
      if (flight.available_capacity < passengers.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: {
            message: `Not enough seats available. Only ${flight.available_capacity} seats left.`,
            code: 'INSUFFICIENT_CAPACITY',
          },
        });
      }

      // Check flight status
      if (flight.status !== 'SCHEDULED') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: { message: 'Flight is not available for booking', code: 'FLIGHT_UNAVAILABLE' },
        });
      }

      // Check MilesSmiles member if memberNumber provided OR if user is authenticated
      let member = null;
      if (memberNumber) {
        const memberResult = await client.query(
          'SELECT * FROM miles_smiles_members WHERE member_number = $1',
          [memberNumber]
        );
        if (memberResult.rows.length > 0) {
          member = memberResult.rows[0];
        }
      } else if (req.user && req.user.email) {
        // If user is authenticated, try to find member by email
        const memberResult = await client.query(
          'SELECT * FROM miles_smiles_members WHERE email = $1',
          [req.user.email]
        );
        if (memberResult.rows.length > 0) {
          member = memberResult.rows[0];
        }
      }

      const pricePerTicket = parseFloat(flight.base_price);
      const totalPrice = pricePerTicket * passengers.length;
      let milesUsed = 0;
      let finalPrice = totalPrice;

      // Handle miles payment
      if (useMiles && member) {
        const milesNeeded = Math.floor(totalPrice * 100); // 100 miles = $1
        if (member.available_miles >= milesNeeded) {
          milesUsed = milesNeeded;
          finalPrice = 0;
        } else {
          // Partial miles payment
          const milesValue = member.available_miles / 100;
          milesUsed = member.available_miles;
          finalPrice = totalPrice - milesValue;
        }
      }

      const bookingReference = generateBookingRef();
      const tickets = [];

      // Create tickets for each passenger
      for (const passenger of passengers) {
        const ticketId = uuidv4();
        const ticketNumber = generateTicketNumber();
        const milesEarned = member ? calculateMilesEarned(pricePerTicket) : 0;

        await client.query(
          `INSERT INTO tickets (
            id, ticket_number, flight_id, member_id,
            passenger_first_name, passenger_last_name, passenger_title,
            passenger_date_of_birth, passenger_email, passenger_phone,
            price_paid, miles_used, miles_earned, payment_method,
            booking_reference, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            ticketId,
            ticketNumber,
            flightId,
            member?.id || null,
            passenger.firstName,
            passenger.lastName,
            passenger.title,
            passenger.dateOfBirth,
            passenger.email || null,
            passenger.phone || null,
            pricePerTicket,
            Math.floor(milesUsed / passengers.length),
            milesEarned,
            useMiles && milesUsed > 0 ? 'MILES' : 'CASH',
            bookingReference,
            'CONFIRMED',
          ]
        );

        tickets.push({
          ticketId,
          ticketNumber,
          passenger: `${passenger.title} ${passenger.firstName} ${passenger.lastName}`,
          price: pricePerTicket,
          milesEarned,
        });
      }

      // Update flight capacity
      await client.query(
        'UPDATE flights SET available_capacity = available_capacity - $1 WHERE id = $2',
        [passengers.length, flightId]
      );

      // Calculate total miles earned from this booking
      const totalMilesEarned = member ? tickets.reduce((sum, t) => sum + t.milesEarned, 0) : 0;

      // Update member miles if applicable
      if (member) {
        // Deduct miles used (if any)
        if (milesUsed > 0) {
          await client.query(
            'UPDATE miles_smiles_members SET available_miles = available_miles - $1 WHERE id = $2',
            [milesUsed, member.id]
          );

          // Record miles debit transaction
          await client.query(
            `INSERT INTO miles_transactions (id, member_id, transaction_type, miles_amount, description, source)
             VALUES ($1, $2, 'DEBIT', $3, $4, 'TICKET_PURCHASE')`,
            [uuidv4(), member.id, milesUsed, `Miles used for ticket purchase ${bookingReference}`]
          );
        }

        // Add miles earned (if any)
        if (totalMilesEarned > 0) {
          await client.query(
            'UPDATE miles_smiles_members SET total_miles = total_miles + $1, available_miles = available_miles + $1 WHERE id = $2',
            [totalMilesEarned, member.id]
          );

          // Record miles credit transaction (one transaction for all tickets in booking)
          if (totalMilesEarned > 0) {
            await client.query(
              `INSERT INTO miles_transactions (id, member_id, transaction_type, miles_amount, description, source)
               VALUES ($1, $2, 'CREDIT', $3, $4, 'TICKET_PURCHASE')`,
              [
                uuidv4(),
                member.id,
                totalMilesEarned,
                `Miles earned from ticket purchase: ${flight.from_code}-${flight.to_code} (Booking: ${bookingReference})`,
              ]
            );
          }
        }
      }

      // Queue ticket notification
      if (req.rabbit) {
        const notificationMessage = {
          type: 'TICKET_CONFIRMATION',
          bookingReference,
          email: passengers[0].email,
          flight: {
            code: flight.flight_code,
            from: flight.from_code,
            to: flight.to_code,
            date: flight.departure_date,
            time: flight.departure_time,
          },
          passengers: passengers.map((p) => `${p.title} ${p.firstName} ${p.lastName}`),
          totalPrice: finalPrice,
        };
        req.rabbit.sendToQueue(
          'ticket_notification_queue',
          Buffer.from(JSON.stringify(notificationMessage)),
          { persistent: true }
        );
      }

      await client.query('COMMIT');

      logger.info(`Tickets purchased: ${bookingReference} for flight ${flight.flight_code}`);

      res.status(201).json({
        success: true,
        data: {
          bookingReference,
          flight: {
            code: flight.flight_code,
            from: flight.from_code,
            to: flight.to_code,
            date: flight.departure_date,
            departureTime: flight.departure_time,
            arrivalTime: flight.arrival_time,
          },
          tickets,
          payment: {
            totalPrice,
            milesUsed,
            finalAmount: finalPrice,
            method: useMiles && milesUsed > 0 ? 'MILES' : 'CASH',
          },
          memberInfo: member
            ? {
                memberNumber: member.member_number,
                milesEarned: tickets.reduce((sum, t) => sum + t.milesEarned, 0),
                remainingMiles: member.available_miles - milesUsed,
              }
            : null,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * @route   GET /api/v1/tickets/:bookingRef
 * @desc    Get tickets by booking reference
 * @access  Public
 */
router.get('/:bookingRef', async (req, res, next) => {
  const { bookingRef } = req.params;

  try {
    const result = await req.db.query(
      `SELECT 
        t.*,
        f.flight_code,
        f.departure_date,
        f.departure_time,
        f.arrival_time,
        f.duration_minutes,
        fa.code as from_airport_code,
        fa.city as from_city,
        ta.code as to_airport_code,
        ta.city as to_city,
        al.name as airline_name
      FROM tickets t
      JOIN flights f ON t.flight_id = f.id
      JOIN airports fa ON f.from_airport_id = fa.id
      JOIN airports ta ON f.to_airport_id = ta.id
      LEFT JOIN airlines al ON f.airline_id = al.id
      WHERE t.booking_reference = $1`,
      [bookingRef.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Booking not found', code: 'NOT_FOUND' },
      });
    }

    res.json({
      success: true,
      data: {
        bookingReference: bookingRef.toUpperCase(),
        tickets: result.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/tickets/member/:memberNumber
 * @desc    Get all tickets for a MilesSmiles member
 * @access  Private
 */
router.get(
  '/member/:memberNumber',
  verifyToken,
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  async (req, res, next) => {
    const { memberNumber } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
      const result = await req.db.query(
        `SELECT 
          t.*,
          f.flight_code,
          f.departure_date,
          f.departure_time,
          fa.code as from_airport_code,
          ta.code as to_airport_code
        FROM tickets t
        JOIN flights f ON t.flight_id = f.id
        JOIN airports fa ON f.from_airport_id = fa.id
        JOIN airports ta ON f.to_airport_id = ta.id
        JOIN miles_smiles_members m ON t.member_id = m.id
        WHERE m.member_number = $1
        ORDER BY t.created_at DESC
        LIMIT $2 OFFSET $3`,
        [memberNumber, parseInt(limit), offset]
      );

      const countResult = await req.db.query(
        `SELECT COUNT(*) as total FROM tickets t
         JOIN miles_smiles_members m ON t.member_id = m.id
         WHERE m.member_number = $1`,
        [memberNumber]
      );

      res.json({
        success: true,
        data: {
          tickets: result.rows,
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

/**
 * @route   POST /api/v1/tickets/:ticketId/cancel
 * @desc    Cancel a ticket
 * @access  Private
 */
router.post('/:ticketId/cancel', verifyToken, async (req, res, next) => {
  const { ticketId } = req.params;
  const client = await req.db.connect();

  try {
    await client.query('BEGIN');

    // Get ticket details
    const ticketResult = await client.query(
      'SELECT * FROM tickets WHERE id = $1 FOR UPDATE',
      [ticketId]
    );

    if (ticketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: { message: 'Ticket not found', code: 'NOT_FOUND' },
      });
    }

    const ticket = ticketResult.rows[0];

    if (ticket.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: { message: 'Ticket already cancelled', code: 'ALREADY_CANCELLED' },
      });
    }

    // Update ticket status
    await client.query(
      "UPDATE tickets SET status = 'CANCELLED' WHERE id = $1",
      [ticketId]
    );

    // Restore flight capacity
    await client.query(
      'UPDATE flights SET available_capacity = available_capacity + 1 WHERE id = $1',
      [ticket.flight_id]
    );

    // Refund miles if applicable
    if (ticket.member_id && ticket.miles_used > 0) {
      await client.query(
        'UPDATE miles_smiles_members SET available_miles = available_miles + $1 WHERE id = $2',
        [ticket.miles_used, ticket.member_id]
      );

      await client.query(
        `INSERT INTO miles_transactions (id, member_id, ticket_id, transaction_type, miles_amount, description, source)
         VALUES ($1, $2, $3, 'CREDIT', $4, 'Ticket cancellation refund', 'REFUND')`,
        [uuidv4(), ticket.member_id, ticketId, ticket.miles_used]
      );
    }

    await client.query('COMMIT');

    logger.info(`Ticket cancelled: ${ticket.ticket_number}`);

    res.json({
      success: true,
      message: 'Ticket cancelled successfully',
      data: {
        ticketNumber: ticket.ticket_number,
        refundedMiles: ticket.miles_used,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
