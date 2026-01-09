require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const amqp = require('amqplib');
const cron = require('node-cron');
const logger = require('./utils/logger');
const emailService = require('./services/emailService');
const scheduledTasks = require('./services/scheduledTasks');

// Import routes
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3003;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

// RabbitMQ connection and consumers
let rabbitConnection;
let rabbitChannel;

const setupQueueConsumers = async () => {
  try {
    rabbitConnection = await amqp.connect(
      process.env.RABBITMQ_URL || 'amqp://localhost'
    );
    rabbitChannel = await rabbitConnection.createChannel();
    
    // Set prefetch to process one message at a time
    rabbitChannel.prefetch(1);

    // Declare queues
    await rabbitChannel.assertQueue('new_member_queue', { durable: true });
    await rabbitChannel.assertQueue('miles_update_queue', { durable: true });
    await rabbitChannel.assertQueue('ticket_notification_queue', { durable: true });

    // Consumer for new member welcome emails
    rabbitChannel.consume('new_member_queue', async (msg) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          logger.info(`Processing new member: ${data.memberNumber}`);
          
          await emailService.sendWelcomeEmail({
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            memberNumber: data.memberNumber,
          });

          // Update database
          await pool.query(
            `UPDATE new_member_queue SET processed = TRUE, processed_at = NOW()
             WHERE member_id = $1`,
            [data.memberId]
          );

          await pool.query(
            'UPDATE miles_smiles_members SET welcome_email_sent = TRUE WHERE id = $1',
            [data.memberId]
          );

          rabbitChannel.ack(msg);
          logger.info(`Welcome email sent to ${data.email}`);
        } catch (error) {
          logger.error('Error processing new member message:', error);
          // Reject and requeue on failure
          rabbitChannel.nack(msg, false, true);
        }
      }
    });

    // Consumer for miles update notifications
    rabbitChannel.consume('miles_update_queue', async (msg) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          logger.info(`Processing miles update for: ${data.memberNumber}`);
          
          await emailService.sendMilesUpdateEmail({
            email: data.email,
            firstName: data.firstName,
            miles: data.miles,
            source: data.source,
            newBalance: data.newBalance,
          });

          rabbitChannel.ack(msg);
          logger.info(`Miles update email sent to ${data.email}`);
        } catch (error) {
          logger.error('Error processing miles update message:', error);
          rabbitChannel.nack(msg, false, true);
        }
      }
    });

    // Consumer for ticket confirmation notifications
    rabbitChannel.consume('ticket_notification_queue', async (msg) => {
      if (msg) {
        try {
          const data = JSON.parse(msg.content.toString());
          logger.info(`Processing ticket confirmation: ${data.bookingReference}`);
          
          await emailService.sendTicketConfirmationEmail(data);

          rabbitChannel.ack(msg);
          logger.info(`Ticket confirmation sent for ${data.bookingReference}`);
        } catch (error) {
          logger.error('Error processing ticket notification:', error);
          rabbitChannel.nack(msg, false, true);
        }
      }
    });

    logger.info('Queue consumers set up successfully');
  } catch (error) {
    logger.error('Failed to set up RabbitMQ:', error);
  }
};

// Setup scheduled tasks (cron jobs)
const setupScheduledTasks = () => {
  // Nightly task at 2:00 AM - Process completed flights and update miles
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running nightly miles update task...');
    await scheduledTasks.processCompletedFlights(pool);
  });

  // Every hour - Process pending welcome emails (fallback for queue failures)
  cron.schedule('0 * * * *', async () => {
    logger.info('Running hourly welcome email check...');
    await scheduledTasks.processPendingWelcomeEmails(pool);
  });

  // Every 6 hours - Send miles summary to members with recent transactions
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Running miles notification task...');
    await scheduledTasks.sendMilesNotifications(pool);
  });

  logger.info('Scheduled tasks set up successfully');
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json());

// Make db available to routes
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Routes
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

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');

    // Setup queue consumers
    await setupQueueConsumers();

    // Setup scheduled tasks
    setupScheduledTasks();

    app.listen(PORT, () => {
      logger.info(`Notification Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (rabbitChannel) await rabbitChannel.close();
  if (rabbitConnection) await rabbitConnection.close();
  await pool.end();
  process.exit(0);
});

startServer();

module.exports = app;
