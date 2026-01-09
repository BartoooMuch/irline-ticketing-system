const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { verifyToken, verifyApiKey } = require('../middleware/auth');
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

/**
 * @route   GET /api/v1/miles/balance
 * @desc    Get member's miles balance
 * @access  Private
 */
router.get('/balance', verifyToken, async (req, res, next) => {
  try {
    const result = await req.db.query(
      `SELECT 
        member_number, total_miles, available_miles, tier
      FROM miles_smiles_members
      WHERE cognito_user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Member not found',
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
 * @route   POST /api/v1/miles/add
 * @desc    Add miles to member account (Partner Airlines - Authenticated Service)
 * @access  Private (API Key)
 */
router.post(
  '/add',
  verifyApiKey,
  [
    body('memberNumber').notEmpty(),
    body('miles').isInt({ min: 1 }),
    body('description').optional().trim(),
    body('referenceNumber').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    const { memberNumber, miles, description, referenceNumber } = req.body;
    const client = await req.db.connect();

    try {
      // Check if partner has permission to add miles
      if (!req.partner.permissions.includes('ADD_MILES')) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Permission denied',
            code: 'FORBIDDEN',
          },
        });
      }

      await client.query('BEGIN');

      // Get member
      const memberResult = await client.query(
        'SELECT * FROM miles_smiles_members WHERE member_number = $1 FOR UPDATE',
        [memberNumber]
      );

      if (memberResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: {
            message: 'Member not found',
            code: 'MEMBER_NOT_FOUND',
          },
        });
      }

      const member = memberResult.rows[0];

      // Update member miles
      await client.query(
        `UPDATE miles_smiles_members 
         SET total_miles = total_miles + $1, 
             available_miles = available_miles + $1 
         WHERE id = $2`,
        [miles, member.id]
      );

      // Create transaction record
      const transactionId = uuidv4();
      await client.query(
        `INSERT INTO miles_transactions (
          id, member_id, transaction_type, miles_amount, 
          description, source, partner_airline_code
        ) VALUES ($1, $2, 'CREDIT', $3, $4, 'PARTNER', $5)`,
        [
          transactionId,
          member.id,
          miles,
          description || `Miles credit from ${req.partner.airlineName}`,
          req.partner.airlineCode,
        ]
      );

      // Queue notification
      if (req.rabbit) {
        const message = {
          type: 'MILES_ADDED',
          memberId: member.id,
          memberNumber,
          email: member.email,
          firstName: member.first_name,
          miles,
          source: req.partner.airlineName,
          newBalance: member.available_miles + miles,
        };
        req.rabbit.sendToQueue(
          'miles_update_queue',
          Buffer.from(JSON.stringify(message)),
          { persistent: true }
        );
      }

      await client.query('COMMIT');

      logger.info(`Miles added: ${miles} to ${memberNumber} by ${req.partner.airlineCode}`);

      res.json({
        success: true,
        data: {
          transactionId,
          memberNumber,
          milesAdded: miles,
          newTotalMiles: member.total_miles + miles,
          newAvailableMiles: member.available_miles + miles,
          source: req.partner.airlineName,
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
 * @route   POST /api/v1/miles/deduct
 * @desc    Deduct miles from member account (for redemption)
 * @access  Private
 */
router.post(
  '/deduct',
  verifyToken,
  [
    body('miles').isInt({ min: 1 }),
    body('reason').notEmpty().trim(),
  ],
  validate,
  async (req, res, next) => {
    const { miles, reason } = req.body;
    const client = await req.db.connect();

    try {
      await client.query('BEGIN');

      // Get member
      const memberResult = await client.query(
        'SELECT * FROM miles_smiles_members WHERE cognito_user_id = $1 FOR UPDATE',
        [req.user.id]
      );

      if (memberResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: {
            message: 'Member not found',
            code: 'NOT_FOUND',
          },
        });
      }

      const member = memberResult.rows[0];

      // Check if enough miles
      if (member.available_miles < miles) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: {
            message: 'Insufficient miles',
            code: 'INSUFFICIENT_MILES',
            availableMiles: member.available_miles,
            requestedMiles: miles,
          },
        });
      }

      // Update member miles
      await client.query(
        'UPDATE miles_smiles_members SET available_miles = available_miles - $1 WHERE id = $2',
        [miles, member.id]
      );

      // Create transaction record
      const transactionId = uuidv4();
      await client.query(
        `INSERT INTO miles_transactions (
          id, member_id, transaction_type, miles_amount, description, source
        ) VALUES ($1, $2, 'DEBIT', $3, $4, 'REDEMPTION')`,
        [transactionId, member.id, miles, reason]
      );

      await client.query('COMMIT');

      logger.info(`Miles deducted: ${miles} from ${member.member_number}`);

      res.json({
        success: true,
        data: {
          transactionId,
          milesDeducted: miles,
          newAvailableMiles: member.available_miles - miles,
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
 * @route   GET /api/v1/miles/transactions
 * @desc    Get miles transactions
 * @access  Private
 */
router.get(
  '/transactions',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['CREDIT', 'DEBIT']),
  ],
  validate,
  async (req, res, next) => {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;

    try {
      // Get member ID
      const memberResult = await req.db.query(
        'SELECT id FROM miles_smiles_members WHERE cognito_user_id = $1',
        [req.user.id]
      );

      if (memberResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Member not found',
            code: 'NOT_FOUND',
          },
        });
      }

      const memberId = memberResult.rows[0].id;

      // Build query
      let queryText = `
        SELECT * FROM miles_transactions
        WHERE member_id = $1
      `;
      const params = [memberId];
      let paramIndex = 2;

      if (type) {
        queryText += ` AND transaction_type = $${paramIndex++}`;
        params.push(type);
      }

      queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(parseInt(limit), offset);

      const result = await req.db.query(queryText, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM miles_transactions WHERE member_id = $1';
      const countParams = [memberId];
      if (type) {
        countQuery += ' AND transaction_type = $2';
        countParams.push(type);
      }
      const countResult = await req.db.query(countQuery, countParams);

      res.json({
        success: true,
        data: {
          transactions: result.rows,
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
 * @route   GET /api/v1/miles/calculate
 * @desc    Calculate how many miles a price is worth
 * @access  Public
 */
router.get('/calculate', async (req, res) => {
  const { price, milesRate = 100 } = req.query;

  if (!price || isNaN(price)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Valid price is required',
        code: 'INVALID_PRICE',
      },
    });
  }

  // 100 miles = $1
  const milesNeeded = Math.ceil(parseFloat(price) * parseFloat(milesRate));
  const milesValue = parseFloat(price);

  res.json({
    success: true,
    data: {
      price: parseFloat(price),
      milesNeeded,
      milesRate: parseInt(milesRate),
      message: `${milesNeeded} miles required for $${price}`,
    },
  });
});

module.exports = router;
