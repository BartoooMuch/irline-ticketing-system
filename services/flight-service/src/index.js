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
const flightRoutes = require('./routes/flights');
const ticketRoutes = require('./routes/tickets');
const airportRoutes = require('./routes/airports');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Redis connection
let redisClient;
const connectRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    await redisClient.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
  }
};

// RabbitMQ connection
let rabbitChannel;
const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || 'amqp://localhost'
    );
    rabbitChannel = await connection.createChannel();
    
    // Declare queues
    await rabbitChannel.assertQueue('new_member_queue', { durable: true });
    await rabbitChannel.assertQueue('miles_update_queue', { durable: true });
    await rabbitChannel.assertQueue('ticket_notification_queue', { durable: true });
    
    logger.info('Connected to RabbitMQ');
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ:', error);
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
app.use(`${API_V1}/flights`, flightRoutes);
app.use(`${API_V1}/tickets`, ticketRoutes);
app.use(`${API_V1}/airports`, airportRoutes);
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
      logger.info(`Flight Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
