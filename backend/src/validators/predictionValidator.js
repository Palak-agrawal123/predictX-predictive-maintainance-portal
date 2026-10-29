import { AppError } from '../middleware/errorHandler.js';

export function validatePredictPayload(req, res, next) {
  const { machineId, sensors } = req.body;
  const errors = [];

  if (!machineId || typeof machineId !== 'string' || machineId.trim().length === 0) {
    errors.push({ field: 'machineId', message: 'Machine ID is required' });
  }

  if (!sensors || typeof sensors !== 'object' || Array.isArray(sensors)) {
    errors.push({ field: 'sensors', message: 'Sensors object with numeric readings is required' });
  } else {
    // Validate core sensor telemetry fields if provided
    const numericFields = [
      'airTemperature',
      'processTemperature',
      'rotationalSpeed',
      'torque',
      'toolWear',
      'vibration',
      'pressureBar',
      'cpuTemp',
      'ramCapacity'
    ];

    let hasAtLeastOneSensor = false;

    for (const [key, val] of Object.entries(sensors)) {
      if (val !== null && val !== undefined) {
        if (typeof val !== 'number' || isNaN(val)) {
          errors.push({ field: `sensors.${key}`, message: `Sensor '${key}' must be a valid number` });
        } else {
          hasAtLeastOneSensor = true;
        }
      }
    }

    if (!hasAtLeastOneSensor) {
      errors.push({
        field: 'sensors',
        message: 'At least one valid numeric sensor reading must be provided (e.g. airTemperature, processTemperature, rotationalSpeed, torque, toolWear)'
      });
    }
  }

  if (errors.length > 0) {
    return next(new AppError('Invalid prediction request payload', 400, errors));
  }

  next();
}
