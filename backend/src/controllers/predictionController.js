import { Machine } from '../models/Machine.js';
import { Prediction } from '../models/Prediction.js';
import { SensorLog } from '../models/SensorLog.js';
import { mlService } from '../services/mlService.js';
import { notificationService } from '../services/notificationService.js';
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

    // 1b. Fetch latest previous prediction to detect state transitions & avoid duplicate spam
    const previousPrediction = await Prediction.findOne({ machineId: cleanMachineId })
      .sort({ predictionTimestamp: -1 })
      .lean();

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
    const oldMachineStatus = machine.status;
    if (predictionData.predictionResult.riskLevel === 'critical' && machine.status === 'operational') {
      machine.status = 'critical';
      await machine.save();
      await notificationService.dispatchEvent('MACHINE_STATUS_CHANGED', {
        machineId: cleanMachineId,
        oldStatus: oldMachineStatus,
        newStatus: 'critical',
        relatedEntityType: 'Machine',
        relatedEntityId: cleanMachineId
      });
    } else if (predictionData.predictionResult.riskLevel === 'high' && machine.status === 'operational') {
      machine.status = 'degraded';
      await machine.save();
      await notificationService.dispatchEvent('MACHINE_STATUS_CHANGED', {
        machineId: cleanMachineId,
        oldStatus: oldMachineStatus,
        newStatus: 'degraded',
        relatedEntityType: 'Machine',
        relatedEntityId: cleanMachineId
      });
    }

    // 7. Event-Driven Notification Generation
    try {
      const currentRisk = (predictionData.predictionResult?.riskLevel || 'medium').toLowerCase();
      const previousRisk = previousPrediction?.predictionResult?.riskLevel?.toLowerCase();
      const riskProb = predictionData.predictionResult?.riskProbability ?? 0;
      const rul = predictionData.predictionResult?.estimatedRULDays;
      const prevRul = previousPrediction?.predictionResult?.estimatedRULDays;

      // A. Critical / High Risk Events
      if (currentRisk === 'critical') {
        await notificationService.dispatchEvent('MACHINE_RISK_CRITICAL', {
          machineId: cleanMachineId,
          riskProbability: riskProb,
          suspectedFailureMode: predictionData.predictionResult?.suspectedFailureMode,
          relatedEntityType: 'Prediction',
          relatedEntityId: predictionId
        });
      } else if (currentRisk === 'high' && previousRisk !== 'high' && previousRisk !== 'critical') {
        await notificationService.dispatchEvent('MACHINE_RISK_HIGH', {
          machineId: cleanMachineId,
          riskProbability: riskProb,
          recommendedAction: predictionData.predictionResult?.recommendedAction,
          relatedEntityType: 'Prediction',
          relatedEntityId: predictionId
        });
      }

      // B. RUL Threshold Events
      if (typeof rul === 'number') {
        if (rul <= 10 && (prevRul === undefined || prevRul > 10)) {
          await notificationService.dispatchEvent('MACHINE_RUL_CRITICAL', {
            machineId: cleanMachineId,
            estimatedRULDays: rul,
            relatedEntityType: 'Prediction',
            relatedEntityId: predictionId
          });
        } else if (rul <= 25 && (prevRul === undefined || prevRul > 25)) {
          await notificationService.dispatchEvent('MACHINE_RUL_WARNING', {
            machineId: cleanMachineId,
            estimatedRULDays: rul,
            relatedEntityType: 'Prediction',
            relatedEntityId: predictionId
          });
        }
      }

      // C. Sensor Anomaly Events
      const vib = Number(sensors?.vibration);
      if (!isNaN(vib) && vib >= 4.5) {
        await notificationService.dispatchEvent('SENSOR_ANOMALY', {
          machineId: cleanMachineId,
          parameter: 'Vibration',
          value: `${vib} mm/s`,
          limit: '4.5 mm/s (ISO 10816-3 Severity limit)',
          relatedEntityType: 'Prediction',
          relatedEntityId: predictionId
        });
      }

      const procTemp = Number(sensors?.processTemperature || sensors?.processTempKelvin);
      if (!isNaN(procTemp) && procTemp >= 345) {
        await notificationService.dispatchEvent('SENSOR_ANOMALY', {
          machineId: cleanMachineId,
          parameter: 'Process Temperature',
          value: `${procTemp} K`,
          limit: '345 K (Thermal limit)',
          relatedEntityType: 'Prediction',
          relatedEntityId: predictionId
        });
      }

      // D. Human Review Verification Request
      if (currentRisk === 'critical' || currentRisk === 'high') {
        await notificationService.dispatchEvent('REVIEW_REQUESTED', {
          machineId: cleanMachineId,
          predictionId,
          relatedEntityType: 'Prediction',
          relatedEntityId: predictionId
        });
      }
    } catch (notifErr) {
      console.warn('[Notification Dispatch Warning] Failed during prediction event dispatch:', notifErr.message);
    }

    // 8. Return standardized response
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
