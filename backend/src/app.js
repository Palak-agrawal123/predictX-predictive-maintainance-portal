import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Route imports
import healthRoutes from './routes/healthRoutes.js';
import machineRoutes from './routes/machineRoutes.js';
import predictionRoutes from './routes/predictionRoutes.js';
import priorityRoutes from './routes/priorityRoutes.js';
import workOrderRoutes from './routes/workOrderRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import modelMetricsRoutes from './routes/modelMetricsRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';

export function createApp() {
  const app = express();

  // 1. CORS configuration
  const allowedOrigins = [
    env.FRONTEND_ORIGIN,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive for local hackathon development
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  );

  // 2. Request body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 3. Request Logging
  app.use(requestLogger);

  // 4. API Endpoints Mounting
  app.use('/api/health', healthRoutes);
  app.use('/api/machines', machineRoutes);
  app.use('/api/predict', predictionRoutes);      // POST /api/predict
  app.use('/api/predictions', predictionRoutes);  // GET /api/predictions
  app.use('/api/machine-priorities', priorityRoutes); // GET /api/machine-priorities
  app.use('/api/reviews', reviewRoutes);          // Human-in-the-Loop Reviews & Overrides
  app.use('/api/dashboard', dashboardRoutes);     // GET /api/dashboard/summary
  app.use('/api/model-metrics', modelMetricsRoutes); // GET /api/model-metrics
  app.use('/api/work-orders', workOrderRoutes);   // /api/work-orders

  // Root welcome route
  app.get('/', (req, res) => {
    res.json({
      name: 'Predictive Maintenance Portal API (DEV-P04)',
      version: '1.0.0',
      docs: '/api/health',
      timestamp: new Date().toISOString()
    });
  });

  // 5. 404 Handler
  app.use(notFoundHandler);

  // 6. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
