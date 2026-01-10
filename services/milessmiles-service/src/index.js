require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const { createClient } = require('redis');
const amqp = require('amqplib');
const logger = require('./utils/logger');

// Import routes
const memberRoutes = require('./routes/members');
const authRoutes = require('./routes/auth');
const milesRoutes = require('./routes/miles');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3002;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

// Redis connection (optional)
let redisClient;
const connectRedis = async () => {
  if (!process.env.REDIS_URL || process.env.REDIS_URL === 'redis://localhost:6379') {
    logger.warn('Redis URL not configured, skipping Redis connection');
    return;
  }
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });
    redisClient.on('error', (err) => logger.warn('Redis Client Error (non-critical):', err.message));
    await redisClient.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.warn('Failed to connect to Redis (continuing without cache):', error.message);
  }
};

// RabbitMQ connection (optional)
let rabbitChannel;
const connectRabbitMQ = async () => {
  if (!process.env.RABBITMQ_URL || process.env.RABBITMQ_URL === 'amqp://localhost') {
    logger.warn('RabbitMQ URL not configured, skipping RabbitMQ connection');
    return;
  }
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    rabbitChannel = await connection.createChannel();
    
    // Declare queues
    await rabbitChannel.assertQueue('new_member_queue', { durable: true });
    await rabbitChannel.assertQueue('miles_update_queue', { durable: true });
    
    logger.info('Connected to RabbitMQ');
  } catch (error) {
    logger.warn('Failed to connect to RabbitMQ (continuing without queue):', error.message);
  }
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json());

// Make db, redis and rabbit available to routes
app.use((req, res, next) => {
  req.db = pool;
  req.redis = redisClient;
  req.rabbit = rabbitChannel;
  next();
});

// API Version prefix
const API_V1 = '/api/v1';

// Routes
app.use(`${API_V1}/members`, memberRoutes);
app.use(`${API_V1}/auth`, authRoutes);
app.use(`${API_V1}/miles`, milesRoutes);
app.use('/health', healthRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Not Found',
      code: 'NOT_FOUND',
    },
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');

    // Connect to Redis
    await connectRedis();

    // Connect to RabbitMQ
    await connectRabbitMQ();

    app.listen(PORT, () => {
      logger.info(`MilesSmiles Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
