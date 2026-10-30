import { Machine } from '../models/Machine.js';
import { SensorLog } from '../models/SensorLog.js';
import { Prediction } from '../models/Prediction.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * GET /api/machines
 * List all machines with optional filters
 */
export async function getAllMachines(req, res, next) {
  try {
    const { status, criticality, machineType, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (criticality) filter.criticality = criticality;
    if (machineType) filter.machineType = machineType;
    if (search) {
      filter.$or = [
        { machineId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    const machines = await Machine.find(filter).sort({ machineId: 1 }).lean();

    res.json({
      success: true,
      count: machines.length,
      data: machines
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/machines/:id
 * Retrieve a single machine by machineId or MongoDB _id
 */
export async function getMachineById(req, res, next) {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { machineId: id.toUpperCase() }] }
      : { machineId: id.toUpperCase() };

    const machine = await Machine.findOne(query).lean();

    if (!machine) {
      return next(new AppError(`Machine not found with identifier: ${id}`, 404));
    }

    // Attach latest prediction summary if available
    const latestPrediction = await Prediction.findOne({ machineId: machine.machineId })
      .sort({ predictionTimestamp: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        ...machine,
        latestPrediction: latestPrediction || null
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/machines
 * Register a new machine
 */
export async function createMachine(req, res, next) {
  try {
    const { machineId } = req.body;
    const existing = await Machine.findOne({ machineId: machineId.toUpperCase() });
    if (existing) {
      return next(new AppError(`Machine with ID '${machineId.toUpperCase()}' already exists`, 409));
    }

    const machine = new Machine({
      ...req.body,
      machineId: machineId.toUpperCase()
    });

    await machine.save();

    res.status(201).json({
      success: true,
      message: 'Machine registered successfully',
      data: machine
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/machines/:id
 * Update machine metadata
 */
export async function updateMachine(req, res, next) {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { machineId: id.toUpperCase() }] }
      : { machineId: id.toUpperCase() };

    // Prevent overwriting machineId
    const updates = { ...req.body };
    delete updates.machineId;
    delete updates._id;

    const machine = await Machine.findOneAndUpdate(query, updates, {
      new: true,
      runValidators: true
    });

    if (!machine) {
      return next(new AppError(`Machine not found with identifier: ${id}`, 404));
    }

    res.json({
      success: true,
      message: 'Machine updated successfully',
      data: machine
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/machines/:id/sensors
 * Retrieve sensor time-series history for a machine
 */
export async function getMachineSensors(req, res, next) {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);

    const machine = await Machine.findOne({
      $or: [{ machineId: id.toUpperCase() }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    }).lean();

    if (!machine) {
      return next(new AppError(`Machine not found with identifier: ${id}`, 404));
    }

    const logs = await SensorLog.find({ machineId: machine.machineId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      machineId: machine.machineId,
      machineName: machine.name,
      count: logs.length,
      data: logs.reverse() // Return in chronological order for graphs
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/machines/:id/predictions
 * Retrieve prediction history for a machine
 */
export async function getMachinePredictions(req, res, next) {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const machine = await Machine.findOne({
      $or: [{ machineId: id.toUpperCase() }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    }).lean();

    if (!machine) {
      return next(new AppError(`Machine not found with identifier: ${id}`, 404));
    }

    const predictions = await Prediction.find({ machineId: machine.machineId })
      .sort({ predictionTimestamp: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      machineId: machine.machineId,
      count: predictions.length,
      data: predictions
    });
  } catch (err) {
    next(err);
  }
}
