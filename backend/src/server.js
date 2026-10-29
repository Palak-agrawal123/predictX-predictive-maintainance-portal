import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';

const app = createApp();

async function startServer() {
  try {
    // 1. Connect to MongoDB
    console.log('[Server] Connecting to MongoDB...');
    await connectDB();

    // 2. Start Express HTTP Server
    const server = app.listen(env.PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Predictive Maintenance API (DEV-P04) is RUNNING`);
      console.log(`📡 URL: http://localhost:${env.PORT}`);
      console.log(`🩺 Healthcheck: http://localhost:${env.PORT}/api/health`);
      console.log(`⚙️  Environment: ${env.NODE_ENV}`);
      console.log(`🤖 ML Service Target: ${env.ML_SERVICE_URL}`);
      console.log(`🔄 Mock ML Adapter: ${env.MOCK_ML_SERVICE ? 'ALWAYS_ON' : 'FALLBACK_ON_ERROR'}`);
      console.log(`====================================================`);
    });

    // 3. Graceful shutdown listeners
    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
      server.close(async () => {
        console.log('[Server] HTTP listener closed.');
        try {
          await disconnectDB();
          console.log('[Server] Clean exit completed.');
          process.exit(0);
        } catch (err) {
          console.error('[Server] Error during DB disconnect:', err);
          process.exit(1);
        }
      });

      // Force exit if not closed within 10 seconds
      setTimeout(() => {
        console.error('[Server] Force shutdown triggered after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('[Server Fatal] Failed to bootstrap server:', error);
    process.exit(1);
  }
}

startServer();
