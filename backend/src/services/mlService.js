import { env } from '../config/env.js';

/**
 * Service to communicate with the Python FastAPI ML microservice.
 * Includes graceful timeout handling, service availability detection,
 * and a physics-based fallback mock adapter strictly tagged with isMock: true.
 */
export class MLService {
  constructor() {
    this.baseUrl = env.ML_SERVICE_URL;
    this.timeoutMs = env.ML_SERVICE_TIMEOUT_MS;
    this.forceMock = env.MOCK_ML_SERVICE;
  }

  /**
   * Check if ML microservice is online
   */
  async checkHealth() {
    if (this.forceMock) {
      return { online: false, reason: 'MOCK_ML_SERVICE flag enabled in environment' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 2000));

    try {
      const response = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return { online: true, details: data };
      }
      return { online: false, status: response.status };
    } catch (err) {
      clearTimeout(timeout);
      return { online: false, error: err.name === 'AbortError' ? 'Healthcheck timeout' : err.message };
    }
  }

  /**
   * Request prediction from FastAPI ML service, falling back to mock adapter if unavailable.
   */
  async predict(machineId, sensorData, machineMetadata = {}) {
    // If explicitly forced to mock via environment
    if (this.forceMock) {
      return this.runMockAdapter(machineId, sensorData, machineMetadata, 'MOCK_ML_SERVICE is set to true');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const payload = {
        machine_id: machineId,
        sensors: sensorData,
        metadata: machineMetadata
      };

      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`ML Service responded with HTTP ${response.status}`);
      }

      const data = await response.json();

      // Validate FastAPI response shape
      if (data && data.prediction) {
        return {
          machineId,
          predictionType: data.predictionType || 'failure_risk_classification',
          predictionResult: {
            riskProbability: Number(data.prediction.riskProbability ?? data.prediction.failure_probability ?? 0.1),
            riskLevel: data.prediction.riskLevel ?? data.prediction.risk_level ?? 'low',
            healthScore: Number(data.prediction.healthScore ?? data.prediction.health_score ?? 90),
            estimatedRULDays: data.prediction.estimatedRULDays ?? data.prediction.days_to_fail ?? null,
            suspectedFailureMode: data.prediction.suspectedFailureMode ?? data.prediction.root_cause ?? 'None',
            recommendedAction: data.prediction.recommendedAction ?? data.prediction.actionable_recommendation ?? 'Routine maintenance',
            confidence: Number(data.prediction.confidence ?? 0.92)
          },
          modelVersion: data.modelVersion || 'fastapi-xgb-v1.0',
          isMock: false,
          executionSource: 'ml_service_fastapi',
          predictionTimestamp: new Date(),
          inputFeatures: sensorData
        };
      }

      throw new Error('Invalid response structure received from ML Service');
    } catch (err) {
      clearTimeout(timeout);
      const reason = err.name === 'AbortError'
        ? `ML Service timeout after ${this.timeoutMs}ms at ${this.baseUrl}`
        : `ML Service unavailable (${err.message})`;

      console.warn(`[ML Service Warning] ${reason}. Engaging transparent fallback mock adapter.`);
      return this.runMockAdapter(machineId, sensorData, machineMetadata, reason);
    }
  }

  /**
   * Physics-grounded mock adapter based on AI4I 2020 Industrial Failure mechanisms.
   * NEVER presented as real ML; explicitly flagged with isMock: true.
   */
  runMockAdapter(machineId, sensors, metadata, fallbackReason) {
    const airTemp = sensors.airTemperature ?? sensors.airTempKelvin ?? 300.0;
    const procTemp = sensors.processTemperature ?? sensors.processTempKelvin ?? 310.0;
    const speed = sensors.rotationalSpeed ?? sensors.rotationalSpeedRpm ?? 1500.0;
    const torque = sensors.torque ?? sensors.torqueNm ?? 40.0;
    const toolWear = sensors.toolWear ?? sensors.toolWearMinutes ?? 0.0;
    const vibration = sensors.vibration ?? sensors.vibrationMmS ?? 2.0;

    const tempDiff = procTemp - airTemp;
    // Power (Watts) = Torque (Nm) * Angular velocity (rad/s)
    const powerWatts = torque * (speed * ((2 * Math.PI) / 60));

    let riskProbability = 0.05; // Baseline healthy probability
    let failureMode = 'None';
    let recommendation = 'Machine operating within normal parameters. Routine monitoring scheduled.';

    // Rule 1: Heat Dissipation Failure (HDF)
    if (tempDiff < 8.6 && speed < 1380) {
      riskProbability = Math.max(riskProbability, 0.82);
      failureMode = 'Heat Dissipation Failure (HDF)';
      recommendation = 'Clean cooling vents and verify coolant flow rate. Temp differential is critically low.';
    }

    // Rule 2: Power Failure (PWF)
    if (powerWatts < 3500 || powerWatts > 9000) {
      riskProbability = Math.max(riskProbability, 0.88);
      failureMode = 'Power Failure (PWF)';
      recommendation = 'Check drive belt tension and electrical power supply. Power load is outside nominal range.';
    }

    // Rule 3: Tool Wear Failure (TWF)
    if (toolWear >= 220) {
      riskProbability = Math.max(riskProbability, 0.95);
      failureMode = 'Tool Wear Failure (TWF)';
      recommendation = 'URGENT: Tool wear has exceeded safe lifetime limit of 220 minutes. Replace cutting insert immediately.';
    } else if (toolWear >= 180) {
      riskProbability = Math.max(riskProbability, 0.65);
      failureMode = 'Elevated Tool Wear';
      recommendation = 'Schedule tool replacement during the next production break.';
    }

    // Rule 4: Overstrain Failure (OSF)
    const overstrain = toolWear * torque;
    if (overstrain > 11000) {
      riskProbability = Math.max(riskProbability, 0.90);
      failureMode = 'Overstrain Failure (OSF)';
      recommendation = 'Reduce spindle torque or feed rate. Excessive mechanical stress on workpiece detected.';
    }

    // Rule 5: Vibration Anomaly
    if (vibration > 4.5) {
      riskProbability = Math.max(riskProbability, 0.75);
      failureMode = failureMode === 'None' ? 'Bearing Misalignment / High Vibration' : failureMode;
      recommendation = 'Inspect spindle bearings and dynamic balancing.';
    }

    // Determine categorical risk level and estimated RUL
    let riskLevel = 'low';
    let estimatedRULDays = 60;
    if (riskProbability >= 0.80) {
      riskLevel = 'critical';
      estimatedRULDays = Math.max(1, Math.round(5 * (1 - riskProbability)));
    } else if (riskProbability >= 0.50) {
      riskLevel = 'high';
      estimatedRULDays = Math.round(14 * (1 - riskProbability) + 5);
    } else if (riskProbability >= 0.25) {
      riskLevel = 'medium';
      estimatedRULDays = Math.round(30 * (1 - riskProbability) + 15);
    }

    const healthScore = Math.max(0, Math.min(100, Math.round((1 - riskProbability) * 100)));

    return {
      machineId,
      predictionType: 'failure_risk_classification',
      predictionResult: {
        riskProbability: Math.round(riskProbability * 1000) / 1000,
        riskLevel,
        healthScore,
        estimatedRULDays,
        suspectedFailureMode: failureMode,
        recommendedAction: recommendation,
        confidence: 0.85
      },
      modelVersion: 'heuristic-physics-mock-v1.0',
      isMock: true,
      executionSource: 'heuristic_mock_adapter',
      fallbackNotice: `Prediction computed by physics-based fallback mock adapter because: ${fallbackReason}. ML Service at ${this.baseUrl} was unreachable or disabled.`,
      predictionTimestamp: new Date(),
      inputFeatures: sensors
    };
  }
}

export const mlService = new MLService();
