const express = require('express');
const router = express.Router();

/**
 * @route   GET /health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'flight-service',
    version: '1.0.0',
    checks: {
      database: 'unknown',
      redis: 'unknown',
      rabbitmq: 'unknown',
    },
  };

  try {
    // Check database
    await req.db.query('SELECT 1');
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }

  try {
    // Check Redis
    if (req.redis) {
      await req.redis.ping();
      health.checks.redis = 'ok';
    } else {
      health.checks.redis = 'not_configured';
    }
  } catch (error) {
    health.checks.redis = 'error';
    health.status = 'degraded';
  }

  try {
    // Check RabbitMQ
    if (req.rabbit) {
      health.checks.rabbitmq = 'ok';
    } else {
      health.checks.rabbitmq = 'not_configured';
    }
  } catch (error) {
    health.checks.rabbitmq = 'error';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * @route   GET /health/ready
 * @desc    Readiness check for Kubernetes
 * @access  Public
 */
router.get('/ready', async (req, res) => {
  try {
    await req.db.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', error: error.message });
  }
});

/**
 * @route   GET /health/live
 * @desc    Liveness check for Kubernetes
 * @access  Public
 */
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

module.exports = router;
