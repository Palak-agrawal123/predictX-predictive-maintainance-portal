import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function notFoundHandler(req, res, next) {
  next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404));
}

// Centralized error handling middleware
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message
    }));
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate key error: A record with that ${field} already exists`;
    details = err.keyValue;
  }

  // Handle Mongoose Invalid ObjectId CastError
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for parameter: ${err.path}`;
  }

  // Avoid leaking internal errors/stack traces in production
  const response = {
    success: false,
    error: {
      message,
      statusCode,
      ...(details && { details }),
      ...(env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  };

  // Log server errors
  if (statusCode >= 500) {
    console.error(`[ERROR 500] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json(response);
}
