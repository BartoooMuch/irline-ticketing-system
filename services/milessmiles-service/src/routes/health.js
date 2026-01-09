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
    service: 'milessmiles-service',
    version: '1.0.0',
    checks: {
      database: 'unknown',
      redis: 'unknown',
      rabbitmq: 'unknown',
    },
  };

  try {
    await req.db.query('SELECT 1');
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }

  try {
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

router.get('/ready', async (req, res) => {
  try {
    await req.db.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', error: error.message });
  }
});

router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

module.exports = router;
