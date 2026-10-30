import { Machine } from '../models/Machine.js';
import { Prediction } from '../models/Prediction.js';
import { SensorLog } from '../models/SensorLog.js';
import { mlService } from '../services/mlService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * POST /api/predict
 * Accepts machineId and sensor features, performs inference, saves result to DB.
 */
export async function runPrediction(req, res, next) {
  try {
    const { machineId, sensors } = req.body;
    const cleanMachineId = machineId.trim().toUpperCase();

    // 1. Verify machine exists in database
    const machine = await Machine.findOne({ machineId: cleanMachineId });
    if (!machine) {
      return next(new AppError(`Referenced machine '${cleanMachineId}' does not exist in registry`, 404));
    }

    // 2. Perform prediction via ML Service (or transparent fallback adapter)
    const predictionData = await mlService.predict(cleanMachineId, sensors, {
      name: machine.name,
      type: machine.machineType,
      criticality: machine.criticality
    });

    // 3. Generate unique prediction ID
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
    const predictionId = `PRD-${dateStr}-${randomHex}`;

    // 4. Persist prediction in MongoDB with Human-in-the-Loop review fields
    const rawRisk = (predictionData.predictionResult?.riskLevel || 'medium').toUpperCase();
    const predictedRisk = rawRisk === 'CRITICAL' ? 'HIGH' : rawRisk;

    const predictionRecord = new Prediction({
      predictionId,
      machineId: cleanMachineId,
      predictionType: predictionData.predictionType,
      predictionResult: predictionData.predictionResult,
      modelVersion: predictionData.modelVersion,
      isMock: predictionData.isMock,
      executionSource: predictionData.executionSource,
      inputFeatures: sensors,
      predictionTimestamp: predictionData.predictionTimestamp,
      // Human Review Workflow Initialization
      predictedRisk,
      maintenancePriority: predictedRisk,
      reviewStatus: 'PENDING',
      isOverridden: false,
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: '',
      reviewHistory: []
    });

    await predictionRecord.save();

    // 5. Store current sensor snapshot in SensorLog for time-series history
    try {
      const sensorLog = new SensorLog({
        machineId: cleanMachineId,
        timestamp: new Date(),
        airTemperature: sensors.airTemperature ?? sensors.airTempKelvin ?? 300,
        processTemperature: sensors.processTemperature ?? sensors.processTempKelvin ?? 310,
        rotationalSpeed: sensors.rotationalSpeed ?? sensors.rotationalSpeedRpm ?? 1500,
        torque: sensors.torque ?? sensors.torqueNm ?? 40,
        toolWear: sensors.toolWear ?? sensors.toolWearMinutes ?? 0,
        vibration: sensors.vibration ?? 2.0,
        pressureBar: sensors.pressureBar ?? 3.5
      });
      await sensorLog.save();
    } catch (logErr) {
      console.warn('[Telemetry Warning] Could not save time-series sensor log point:', logErr.message);
    }

    // 6. Conditionally update machine status if high/critical risk is predicted
    if (predictionData.predictionResult.riskLevel === 'critical' && machine.status === 'operational') {
      machine.status = 'critical';
      await machine.save();
    } else if (predictionData.predictionResult.riskLevel === 'high' && machine.status === 'operational') {
      machine.status = 'degraded';
      await machine.save();
    }

    // 7. Return standardized response
    res.status(201).json({
      success: true,
      message: 'Prediction evaluated and logged successfully',
      data: {
        predictionId,
        machineId: cleanMachineId,
        predictionType: predictionRecord.predictionType,
        predictionResult: predictionRecord.predictionResult,
        predictedRisk: predictionRecord.predictedRisk,
        maintenancePriority: predictionRecord.maintenancePriority,
        reviewStatus: predictionRecord.reviewStatus,
        isOverridden: predictionRecord.isOverridden,
        modelVersion: predictionRecord.modelVersion,
        isMock: predictionRecord.isMock,
        executionSource: predictionRecord.executionSource,
        predictionTimestamp: predictionRecord.predictionTimestamp,
        ...(predictionData.fallbackNotice && { fallbackNotice: predictionData.fallbackNotice })
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/predictions
 * List all historical predictions with filters
 */
export async function getAllPredictions(req, res, next) {
  try {
    const { machineId, riskLevel, isMock, limit = 50, page = 1 } = req.query;
    const filter = {};

    if (machineId) filter.machineId = machineId.toUpperCase();
    if (riskLevel) filter['predictionResult.riskLevel'] = riskLevel;
    if (isMock !== undefined) filter.isMock = isMock === 'true';

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [total, predictions] = await Promise.all([
      Prediction.countDocuments(filter),
      Prediction.find(filter)
        .sort({ predictionTimestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    res.json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      count: predictions.length,
      data: predictions
    });
  } catch (err) {
    next(err);
  }
}
