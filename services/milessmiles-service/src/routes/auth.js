const express = require('express');
const { body, validationResult } = require('express-validator');
const { CognitoIdentityProviderClient, InitiateAuthCommand, GlobalSignOutCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

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
 * @route   POST /api/v1/auth/login
 * @desc    Login with email and password
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    const { email, password } = req.body;

    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.AWS_COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const response = await cognitoClient.send(command);

      if (!response.AuthenticationResult) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication failed',
            code: 'AUTH_FAILED',
          },
        });
      }

      // Get member details
      const memberResult = await req.db.query(
        `SELECT 
          id, member_number, email, first_name, last_name, title,
          total_miles, available_miles, tier
        FROM miles_smiles_members
        WHERE email = $1`,
        [email]
      );

      const member = memberResult.rows[0] || null;

      logger.info(`User logged in: ${email}`);

      res.json({
        success: true,
        data: {
          tokens: {
            accessToken: response.AuthenticationResult.AccessToken,
            refreshToken: response.AuthenticationResult.RefreshToken,
            idToken: response.AuthenticationResult.IdToken,
            expiresIn: response.AuthenticationResult.ExpiresIn,
          },
          member,
        },
      });
    } catch (error) {
      logger.error('Login error:', error);
      
      if (error.name === 'NotAuthorizedException') {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS',
          },
        });
      }

      if (error.name === 'UserNotConfirmedException') {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Please confirm your email first',
            code: 'USER_NOT_CONFIRMED',
          },
        });
      }

      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  [body('refreshToken').notEmpty()],
  validate,
  async (req, res, next) => {
    const { refreshToken } = req.body;

    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: process.env.AWS_COGNITO_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const response = await cognitoClient.send(command);

      if (!response.AuthenticationResult) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Token refresh failed',
            code: 'REFRESH_FAILED',
          },
        });
      }

      res.json({
        success: true,
        data: {
          accessToken: response.AuthenticationResult.AccessToken,
          idToken: response.AuthenticationResult.IdToken,
          expiresIn: response.AuthenticationResult.ExpiresIn,
        },
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      
      if (error.name === 'NotAuthorizedException') {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid refresh token',
            code: 'INVALID_REFRESH_TOKEN',
          },
        });
      }

      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (invalidate tokens)
 * @access  Private
 */
router.post('/logout', verifyToken, async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader.split(' ')[1];

    const command = new GlobalSignOutCommand({
      AccessToken: accessToken,
    });

    await cognitoClient.send(command);

    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    // Even if logout fails on Cognito side, return success to client
    res.json({
      success: true,
      message: 'Logged out',
    });
  }
});

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const memberResult = await req.db.query(
      `SELECT 
        id, member_number, email, first_name, last_name, title,
        total_miles, available_miles, tier, created_at
      FROM miles_smiles_members
      WHERE cognito_user_id = $1`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        user: req.user,
        member: memberResult.rows[0] || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
