const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const logger = require('../utils/logger');

// JWKS client cache by issuer (prevents env mismatch issues across services)
const jwksClientsByIssuer = new Map();
const getJwksClientForIssuer = (issuer) => {
  const key = issuer || 'default';
  if (jwksClientsByIssuer.has(key)) return jwksClientsByIssuer.get(key);

  const jwksUri = issuer
    ? `${issuer}/.well-known/jwks.json`
    : `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

  const client = jwksClient({
    jwksUri,
    cache: true,
    cacheMaxAge: 600000, // 10 minutes
  });
  jwksClientsByIssuer.set(key, client);
  return client;
};

const makeGetKey = (issuer) => (header, callback) => {
  const client = getJwksClientForIssuer(issuer);
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
  const decoded = jwt.decode(token, { complete: true })?.payload || {};
  const issuer = decoded.iss || `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_COGNITO_USER_POOL_ID}`;

  jwt.verify(
    token,
    makeGetKey(issuer),
    {
      issuer,
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
  const decoded = jwt.decode(token, { complete: true })?.payload || {};
  const issuer = decoded.iss || `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_COGNITO_USER_POOL_ID}`;

  jwt.verify(
    token,
    makeGetKey(issuer),
    {
      issuer,
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
