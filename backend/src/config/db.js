import mongoose from 'mongoose';
import { env } from './env.js';

let isConnected = false;

export async function connectDB(customUri = null) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = customUri || env.MONGODB_URI;

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[MongoDB] Connected to database: ${conn.connection.name} @ ${conn.connection.host}:${conn.connection.port}`);
    return conn;
  } catch (error) {
    isConnected = false;
    console.error(`[MongoDB] Connection error: ${error.message}`);
    throw error;
  }
}

export async function disconnectDB() {
  if (!isConnected && mongoose.connection.readyState === 0) {
    return;
  }
  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error(`[MongoDB] Disconnection error: ${error.message}`);
    throw error;
  }
}
