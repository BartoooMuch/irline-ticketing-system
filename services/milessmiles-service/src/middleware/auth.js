const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const crypto = require('crypto');
const logger = require('../utils/logger');

// JWKS client for AWS Cognito
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000,
});

const getKey = (header, callback) => {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      logger.error('Error getting signing key:', err);
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
};

// Verify JWT token from Cognito
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'No token provided',
        code: 'UNAUTHORIZED',
      },
    });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(
    token,
    getKey,
    {
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_COGNITO_USER_POOL_ID}`,
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (err) {
        logger.error('Token verification failed:', err);
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid token',
            code: 'INVALID_TOKEN',
          },
        });
      }

      req.user = {
        id: decoded.sub,
        email: decoded.email,
        username: decoded['cognito:username'],
        groups: decoded['cognito:groups'] || [],
      };
      next();
    }
  );
};

// Verify API key for partner airlines
const verifyApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const apiSecret = req.headers['x-api-secret'];

  if (!apiKey || !apiSecret) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'API key and secret required',
        code: 'UNAUTHORIZED',
      },
    });
  }

  try {
    const result = await req.db.query(
      `SELECT ak.*, al.code as airline_code, al.name as airline_name
       FROM api_keys ak
       LEFT JOIN airlines al ON ak.airline_id = al.id
       WHERE ak.api_key = $1 AND ak.is_active = TRUE`,
      [apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid API key',
          code: 'INVALID_API_KEY',
        },
      });
    }

    const keyData = result.rows[0];

    // Verify API secret
    const secretHash = crypto.createHash('sha256').update(apiSecret).digest('hex');
    if (secretHash !== keyData.api_secret_hash) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid API secret',
          code: 'INVALID_API_SECRET',
        },
      });
    }

    // Check expiration
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'API key expired',
          code: 'API_KEY_EXPIRED',
        },
      });
    }

    // Update last used
    await req.db.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [keyData.id]
    );

    req.partner = {
      id: keyData.id,
      airlineId: keyData.airline_id,
      airlineCode: keyData.airline_code,
      airlineName: keyData.airline_name,
      permissions: keyData.permissions,
    };

    next();
  } catch (error) {
    logger.error('API key verification error:', error);
    next(error);
  }
};

// Optional authentication
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(
    token,
    getKey,
    {
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_COGNITO_USER_POOL_ID}`,
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (!err && decoded) {
        req.user = {
          id: decoded.sub,
          email: decoded.email,
          username: decoded['cognito:username'],
          groups: decoded['cognito:groups'] || [],
        };
      }
      next();
    }
  );
};

module.exports = {
  verifyToken,
  verifyApiKey,
  optionalAuth,
};
