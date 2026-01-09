const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../middleware/auth');
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

// Generate member number
const generateMemberNumber = async (db) => {
  const result = await db.query(
    `SELECT COALESCE(MAX(SUBSTRING(member_number FROM 3)::INTEGER), 0) + 1 as next_num
     FROM miles_smiles_members`
  );
  const nextNum = result.rows[0].next_num;
  return `MS${nextNum.toString().padStart(10, '0')}`;
};

/**
 * @route   POST /api/v1/members/register
 * @desc    Register as a new MilesSmiles member
 * @access  Public
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('title').isIn(['Mr', 'Ms', 'Mrs', 'Miss']),
    body('dateOfBirth').isISO8601(),
    body('phone').optional().trim(),
    body('password').isLength({ min: 8 }),
  ],
  validate,
  async (req, res, next) => {
    const { email, firstName, lastName, title, dateOfBirth, phone, password } = req.body;

    try {
      // Check if email already exists
      const existingMember = await req.db.query(
        'SELECT id FROM miles_smiles_members WHERE email = $1',
        [email]
      );

      if (existingMember.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Email already registered',
            code: 'EMAIL_EXISTS',
          },
        });
      }

      // Create user in AWS Cognito
      const { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } = require('@aws-sdk/client-cognito-identity-provider');
      
      const cognitoClient = new CognitoIdentityProviderClient({
        region: process.env.AWS_REGION,
      });

      let cognitoUserId;
      try {
        const signUpCommand = new SignUpCommand({
          ClientId: process.env.AWS_COGNITO_CLIENT_ID,
          Username: email,
          Password: password,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'given_name', Value: firstName },
            { Name: 'family_name', Value: lastName },
          ],
        });

        const cognitoResponse = await cognitoClient.send(signUpCommand);
        cognitoUserId = cognitoResponse.UserSub;

        // Auto-confirm user for demo purposes (in production, use email verification)
        if (process.env.NODE_ENV === 'development') {
          const confirmCommand = new AdminConfirmSignUpCommand({
            UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
            Username: email,
          });
          await cognitoClient.send(confirmCommand);
        }
      } catch (cognitoError) {
        logger.error('Cognito registration error:', cognitoError);
        return res.status(400).json({
          success: false,
          error: {
            message: cognitoError.message || 'Failed to create account',
            code: 'COGNITO_ERROR',
          },
        });
      }

      // Generate member number
      const memberNumber = await generateMemberNumber(req.db);

      // Create member in database
      const memberId = uuidv4();
      const result = await req.db.query(
        `INSERT INTO miles_smiles_members (
          id, cognito_user_id, member_number, email, first_name, last_name,
          title, date_of_birth, phone, total_miles, available_miles
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0)
        RETURNING id, member_number, email, first_name, last_name, title, created_at`,
        [memberId, cognitoUserId, memberNumber, email, firstName, lastName, title, dateOfBirth, phone]
      );

      // Add to new member queue for welcome email
      if (req.rabbit) {
        const message = {
          type: 'NEW_MEMBER',
          memberId,
          memberNumber,
          email,
          firstName,
          lastName,
        };
        req.rabbit.sendToQueue(
          'new_member_queue',
          Buffer.from(JSON.stringify(message)),
          { persistent: true }
        );
      }

      // Also insert into new_member_queue table for backup
      await req.db.query(
        'INSERT INTO new_member_queue (id, member_id) VALUES ($1, $2)',
        [uuidv4(), memberId]
      );

      logger.info(`New member registered: ${memberNumber}`);

      res.status(201).json({
        success: true,
        message: 'Registration successful. Welcome email will be sent shortly.',
        data: {
          ...result.rows[0],
          initialMiles: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/members/profile
 * @desc    Get current member's profile
 * @access  Private
 */
router.get('/profile', verifyToken, async (req, res, next) => {
  try {
    const result = await req.db.query(
      `SELECT 
        id, member_number, email, first_name, last_name, title,
        date_of_birth, phone, total_miles, available_miles, tier,
        created_at, updated_at
      FROM miles_smiles_members
      WHERE cognito_user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Member profile not found',
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
 * @route   PUT /api/v1/members/profile
 * @desc    Update member profile
 * @access  Private
 */
router.put(
  '/profile',
  verifyToken,
  [
    body('phone').optional().trim(),
    body('title').optional().isIn(['Mr', 'Ms', 'Mrs', 'Miss']),
  ],
  validate,
  async (req, res, next) => {
    const { phone, title } = req.body;

    try {
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        values.push(phone);
      }
      if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(title);
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

      values.push(req.user.id);

      const result = await req.db.query(
        `UPDATE miles_smiles_members 
         SET ${updates.join(', ')} 
         WHERE cognito_user_id = $${paramIndex}
         RETURNING id, member_number, email, first_name, last_name, title, phone`,
        values
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
  }
);

/**
 * @route   GET /api/v1/members/:memberNumber
 * @desc    Get member by member number
 * @access  Private
 */
router.get('/:memberNumber', verifyToken, async (req, res, next) => {
  const { memberNumber } = req.params;

  try {
    const result = await req.db.query(
      `SELECT 
        id, member_number, email, first_name, last_name, title,
        total_miles, available_miles, tier
      FROM miles_smiles_members
      WHERE member_number = $1`,
      [memberNumber]
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
 * @route   GET /api/v1/members/transactions
 * @desc    Get member's miles transaction history
 * @access  Private
 */
router.get(
  '/transactions/history',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  async (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    try {
      // Get member ID first
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

      const result = await req.db.query(
        `SELECT 
          mt.*,
          t.ticket_number,
          f.flight_code,
          fa.code as from_airport,
          ta.code as to_airport
        FROM miles_transactions mt
        LEFT JOIN tickets t ON mt.ticket_id = t.id
        LEFT JOIN flights f ON t.flight_id = f.id
        LEFT JOIN airports fa ON f.from_airport_id = fa.id
        LEFT JOIN airports ta ON f.to_airport_id = ta.id
        WHERE mt.member_id = $1
        ORDER BY mt.created_at DESC
        LIMIT $2 OFFSET $3`,
        [memberId, parseInt(limit), offset]
      );

      const countResult = await req.db.query(
        'SELECT COUNT(*) as total FROM miles_transactions WHERE member_id = $1',
        [memberId]
      );

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

module.exports = router;
