import { Router } from 'express';
import mongoose from 'mongoose';
import { mlService } from '../services/mlService.js';
import { env } from '../config/env.js';

const router = Router();

/**
 * GET /api/health
 * Comprehensive system health including Mongo connection, ML engine, and uptime
 */
router.get('/', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const mlHealth = await mlService.checkHealth();

  const isHealthy = mongoStatus === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'predictive-maintenance-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    components: {
      database: {
        status: mongoStatus,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      },
      mlMicroservice: {
        configuredUrl: env.ML_SERVICE_URL,
        status: mlHealth.online ? 'online' : 'offline',
        mockFallbackActive: !mlHealth.online || env.MOCK_ML_SERVICE,
        details: mlHealth
      }
    }
  });
});

export default router;
