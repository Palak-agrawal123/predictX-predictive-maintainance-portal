import { AppError } from '../middleware/errorHandler.js';

const VALID_MACHINE_TYPES = [
  'CNC_MILL',
  'HYDRAULIC_PRESS',
  'TURBINE',
  'ROBOTIC_ARM',
  'CENTRIFUGAL_PUMP',
  'COMPRESSOR',
  'CONVEYOR',
  'OTHER'
];

const VALID_STATUSES = ['operational', 'degraded', 'critical', 'maintenance', 'offline'];
const VALID_CRITICALITIES = ['low', 'medium', 'high', 'critical'];

export function validateCreateMachine(req, res, next) {
  const { machineId, name, machineType, location, downtimeCostPerHour, status, criticality } = req.body;
  const errors = [];

  if (!machineId || typeof machineId !== 'string' || machineId.trim().length < 2) {
    errors.push({ field: 'machineId', message: 'Machine ID must be a string with at least 2 characters' });
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Machine name is required' });
  }

  if (machineType && !VALID_MACHINE_TYPES.includes(machineType)) {
    errors.push({
      field: 'machineType',
      message: `Machine type must be one of: ${VALID_MACHINE_TYPES.join(', ')}`
    });
  }

  if (!location || typeof location !== 'string' || location.trim().length === 0) {
    errors.push({ field: 'location', message: 'Machine location is required' });
  }

  if (downtimeCostPerHour !== undefined && (typeof downtimeCostPerHour !== 'number' || downtimeCostPerHour < 0)) {
    errors.push({ field: 'downtimeCostPerHour', message: 'Downtime cost per hour must be a non-negative number' });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  if (criticality && !VALID_CRITICALITIES.includes(criticality)) {
    errors.push({ field: 'criticality', message: `Criticality must be one of: ${VALID_CRITICALITIES.join(', ')}` });
  }

  if (errors.length > 0) {
    return next(new AppError('Invalid machine registration data', 400, errors));
  }

  next();
}

export function validateUpdateMachine(req, res, next) {
  const { machineType, status, criticality, downtimeCostPerHour } = req.body;
  const errors = [];

  if (machineType && !VALID_MACHINE_TYPES.includes(machineType)) {
    errors.push({
      field: 'machineType',
      message: `Machine type must be one of: ${VALID_MACHINE_TYPES.join(', ')}`
    });
  }

  if (status && !VALID_STATUSES.includes(status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  if (criticality && !VALID_CRITICALITIES.includes(criticality)) {
    errors.push({ field: 'criticality', message: `Criticality must be one of: ${VALID_CRITICALITIES.join(', ')}` });
  }

  if (downtimeCostPerHour !== undefined && (typeof downtimeCostPerHour !== 'number' || downtimeCostPerHour < 0)) {
    errors.push({ field: 'downtimeCostPerHour', message: 'Downtime cost per hour must be a non-negative number' });
  }

  if (errors.length > 0) {
    return next(new AppError('Invalid machine update data', 400, errors));
  }

  next();
}
