import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/predictive_maintenance_dev',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000',
  ML_SERVICE_TIMEOUT_MS: parseInt(process.env.ML_SERVICE_TIMEOUT_MS, 10) || 4000,
  MOCK_ML_SERVICE: process.env.MOCK_ML_SERVICE === 'true',
  
  // Python FastAPI RAG Service
  RAG_SERVICE_URL: process.env.RAG_SERVICE_URL || 'http://127.0.0.1:8001',
  RAG_SERVICE_TIMEOUT_MS: parseInt(process.env.RAG_SERVICE_TIMEOUT_MS, 10) || 15000,

  // Priority scoring weights
  PRIORITY_WEIGHT_RISK: parseFloat(process.env.PRIORITY_WEIGHT_RISK) || 0.50,
  PRIORITY_WEIGHT_CRITICALITY: parseFloat(process.env.PRIORITY_WEIGHT_CRITICALITY) || 0.25,
  PRIORITY_WEIGHT_COST: parseFloat(process.env.PRIORITY_WEIGHT_COST) || 0.15,
  PRIORITY_WEIGHT_RECENCY: parseFloat(process.env.PRIORITY_WEIGHT_RECENCY) || 0.10,
  BENCHMARK_MAX_DOWNTIME_COST: parseFloat(process.env.BENCHMARK_MAX_DOWNTIME_COST) || 10000
};
