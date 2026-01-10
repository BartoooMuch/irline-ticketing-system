require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3000;

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Service URLs - Production Render URLs with fallback
const SERVICES = {
  flight: process.env.FLIGHT_SERVICE_URL || 'https://flight-service-rvlh.onrender.com',
  milessmiles: process.env.MILESSMILES_SERVICE_URL || 'https://milessmiles-service.onrender.com',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003',
  ml: process.env.ML_SERVICE_URL || 'https://ml-service-3cex.onrender.com',
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
});

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
  },
});

// Middleware
app.set('trust proxy', 1); // Trust proxy for rate limiting on Render
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// Manual proxy middleware using axios
const proxyTo = (serviceKey) => async (req, res) => {
  const targetUrl = SERVICES[serviceKey];
  const fullUrl = `${targetUrl}${req.path}`;
  
  try {
    logger.info(`Proxying ${req.method} ${req.path} -> ${fullUrl}`);
    
    // Forward only safe headers
    const headers = {};
    
    // Forward content-type if present
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'];
    }
    
    // Forward auth headers if present
    if (req.headers.authorization) {
      headers.authorization = req.headers.authorization;
    }
    if (req.headers['x-api-key']) {
      headers['x-api-key'] = req.headers['x-api-key'];
    }
    if (req.headers['x-api-secret']) {
      headers['x-api-secret'] = req.headers['x-api-secret'];
    }
    
    const axiosConfig = {
      method: req.method,
      url: fullUrl,
      params: req.query,
      headers,
      timeout: 30000,
      validateStatus: () => true, // Accept any status
    };
    
    // Forward body for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      axiosConfig.data = req.body;
      logger.info(`Forwarding body:`, req.body);
    }
    
    const response = await axios(axiosConfig);
    
    logger.info(`Response from ${serviceKey}: ${response.status}`);
    
    // Forward response status
    res.status(response.status);
    
    // Forward response headers
    if (response.headers['content-type']) {
      res.setHeader('content-type', response.headers['content-type']);
    }
    if (response.headers['set-cookie']) {
      res.setHeader('set-cookie', response.headers['set-cookie']);
    }
    
    // Send response
    res.send(response.data);
  } catch (error) {
    logger.error(`Proxy error for ${serviceKey}:`, {
      message: error.message,
      code: error.code,
      response: error.response?.data,
    });
    res.status(502).json({
      success: false,
      error: {
        message: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        details: error.message,
      },
    });
  }
};

// =====================
// API Routes
// =====================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    services: SERVICES,
  });
});

// Flight Service Routes
app.all('/api/v1/flights*', proxyTo('flight'));
app.all('/api/v1/tickets*', proxyTo('flight'));
app.all('/api/v1/airports*', proxyTo('flight'));

// MilesSmiles Service Routes
app.all('/api/v1/auth*', authLimiter, proxyTo('milessmiles'));
app.all('/api/v1/members*', proxyTo('milessmiles'));
app.all('/api/v1/miles*', proxyTo('milessmiles'));

// ML Service Routes
app.all('/api/v1/predict*', proxyTo('ml'));

// Service health endpoints
app.get('/api/v1/services/health', async (req, res) => {
  const healthChecks = {};
  
  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 5000 });
      healthChecks[name] = { status: 'healthy', data: response.data };
    } catch (error) {
      healthChecks[name] = { status: 'unhealthy', error: error.message };
    }
  }
  
  const allHealthy = Object.values(healthChecks).every(h => h.status === 'healthy');
  
  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    services: healthChecks,
    timestamp: new Date().toISOString(),
  });
});

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Airline Ticketing System API',
    version: '1.0.0',
    endpoints: {
      flights: {
        'GET /api/v1/flights/search': 'Search flights',
        'GET /api/v1/flights/:id': 'Get flight by ID',
        'POST /api/v1/flights': 'Create flight (Admin)',
        'PUT /api/v1/flights/:id': 'Update flight (Admin)',
        'GET /api/v1/flights/admin/list': 'List all flights (Admin)',
      },
      tickets: {
        'POST /api/v1/tickets/buy': 'Buy ticket(s)',
        'GET /api/v1/tickets/:bookingRef': 'Get tickets by booking reference',
        'GET /api/v1/tickets/member/:memberNumber': 'Get member tickets',
        'POST /api/v1/tickets/:ticketId/cancel': 'Cancel ticket',
      },
      airports: {
        'GET /api/v1/airports': 'List all airports',
        'GET /api/v1/airports/:code': 'Get airport by code',
        'GET /api/v1/airports/destinations/:fromCode': 'Get destinations',
        'GET /api/v1/airports/search/autocomplete': 'Autocomplete search',
      },
      auth: {
        'POST /api/v1/auth/login': 'Login',
        'POST /api/v1/auth/refresh': 'Refresh token',
        'POST /api/v1/auth/logout': 'Logout',
        'GET /api/v1/auth/me': 'Get current user',
      },
      members: {
        'POST /api/v1/members/register': 'Register new member',
        'GET /api/v1/members/profile': 'Get profile',
        'PUT /api/v1/members/profile': 'Update profile',
        'GET /api/v1/members/transactions/history': 'Transaction history',
      },
      miles: {
        'GET /api/v1/miles/balance': 'Get miles balance',
        'POST /api/v1/miles/add': 'Add miles (Partner API)',
        'POST /api/v1/miles/deduct': 'Deduct miles',
        'GET /api/v1/miles/transactions': 'Get transactions',
        'GET /api/v1/miles/calculate': 'Calculate miles value',
      },
      prediction: {
        'POST /api/v1/predict': 'Predict flight price',
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
    },
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
});

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info('Services configuration:', SERVICES);
});

module.exports = app;
