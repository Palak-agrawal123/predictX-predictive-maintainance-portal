import { AppError } from '../middleware/errorHandler.js';

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES = ['draft', 'approved', 'in_progress', 'completed', 'cancelled'];

export function validateCreateWorkOrder(req, res, next) {
  const { machineId, title, description, priority, status } = req.body;
  const errors = [];

  if (!machineId || typeof machineId !== 'string' || machineId.trim().length === 0) {
    errors.push({ field: 'machineId', message: 'Machine ID is required' });
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Work order title is required' });
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Work order description is required' });
  }

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    errors.push({ field: 'priority', message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  if (errors.length > 0) {
    return next(new AppError('Invalid work order creation payload', 400, errors));
  }

  next();
}

export function validateUpdateWorkOrderStatus(req, res, next) {
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return next(
      new AppError(
        `Invalid status. Status must be one of: ${VALID_STATUSES.join(', ')}`,
        400,
        { allowedStatuses: VALID_STATUSES }
      )
    );
  }

  next();
}

export function validateUpdateWorkOrder(req, res, next) {
  const { priority, status } = req.body;
  const errors = [];

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    errors.push({ field: 'priority', message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  if (errors.length > 0) {
    return next(new AppError('Invalid work order update payload', 400, errors));
  }

  next();
}
