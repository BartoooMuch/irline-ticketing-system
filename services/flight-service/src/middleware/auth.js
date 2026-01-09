const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const logger = require('../utils/logger');

// JWKS client for AWS Cognito
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
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

// Check if user has admin role
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.groups.includes('ADMIN')) {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Admin access required',
        code: 'FORBIDDEN',
      },
    });
  }
  next();
};

// Optional authentication - doesn't fail if no token
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
  requireAdmin,
  optionalAuth,
};
