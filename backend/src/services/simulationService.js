import { env } from '../config/env.js';
import { Machine } from '../models/Machine.js';
import { Prediction } from '../models/Prediction.js';
import { SensorLog } from '../models/SensorLog.js';
import { notificationService } from './notificationService.js';

class SimulationService {
  constructor() {
    this.mlBaseUrl = env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
    this.timeoutMs = 6000;
  }

  async fetchFromML(endpoint, method = 'GET', body = null) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      };
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.mlBaseUrl}${endpoint}`, options);
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`ML Service error ${response.status} from ${endpoint}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  async startSimulation(config) {
    const res = await this.fetchFromML('/api/simulation/start', 'POST', config);
    await this.ensureDemoMachinesRegistered();
    return res;
  }

  async pauseSimulation() {
    return await this.fetchFromML('/api/simulation/pause', 'POST');
  }

  async resumeSimulation() {
    return await this.fetchFromML('/api/simulation/resume', 'POST');
  }

  async stopSimulation() {
    return await this.fetchFromML('/api/simulation/stop', 'POST');
  }

  async resetSimulation() {
    return await this.fetchFromML('/api/simulation/reset', 'POST');
  }

  async getStatus() {
    return await this.fetchFromML('/api/simulation/status', 'GET');
  }

  async getTelemetry(machineId, limit) {
    let url = `/api/simulation/telemetry?limit=${limit || 50}`;
    if (machineId) url += `&machine_id=${encodeURIComponent(machineId)}`;
    return await this.fetchFromML(url, 'GET');
  }

  async ingestTelemetry(payload) {
    return await this.fetchFromML('/api/telemetry/ingest', 'POST', payload);
  }

  // --- Dataset Management Proxy Methods ---
  async listDatasets() {
    return await this.fetchFromML('/api/simulation/datasets', 'GET');
  }

  async getDataset(datasetId) {
    return await this.fetchFromML(`/api/simulation/datasets/${encodeURIComponent(datasetId)}`, 'GET');
  }

  async previewDataset(datasetId, limit = 15) {
    return await this.fetchFromML(`/api/simulation/datasets/${encodeURIComponent(datasetId)}/preview?limit=${limit}`, 'GET');
  }

  async configureDataset(datasetId, config) {
    return await this.fetchFromML(`/api/simulation/datasets/${encodeURIComponent(datasetId)}/configure`, 'POST', config);
  }

  async switchFleet(fleet) {
    return await this.fetchFromML('/api/simulation/switch-fleet', 'POST', { fleet });
  }

  /**
   * Syncs a simulated prediction frame into MongoDB to integrate with
   * Machine fleet health, Priority ranking, Human Review, and Notifications.
   */
  async syncSimulationPrediction({
    machineId,
    subset = 'INDUSTRIAL_IOT',
    cycle = 1,
    prediction,
    modelMetadata = {},
    cleanedSensors = {}
  }) {
    if (!machineId || !prediction) return null;
    const cleanMachineId = machineId.trim().toUpperCase();
    const isMotor = cleanMachineId.startsWith('MOTOR-') || subset === 'INDUSTRIAL_IOT';

    try {
      // 1. Ensure machine exists in DB
      let machine = await Machine.findOne({ machineId: cleanMachineId });
      if (!machine) {
        const defaultName = cleanMachineId === 'MOTOR-001'
          ? 'Centrifugal Water Pump Motor'
          : cleanMachineId === 'MOTOR-002'
          ? 'CNC Extruder Spindle Motor'
          : cleanMachineId === 'MOTOR-003'
          ? 'Gas Booster Compressor Motor'
          : `Industrial Machine ${cleanMachineId}`;

        const defaultType = cleanMachineId === 'MOTOR-001'
          ? 'PUMP'
          : cleanMachineId === 'MOTOR-003'
          ? 'COMPRESSOR'
          : isMotor ? 'MOTOR' : 'TURBINE';

        machine = new Machine({
          machineId: cleanMachineId,
          name: defaultName,
          machineType: defaultType,
          location: isMotor ? 'Industrial Facility Bay 4' : 'Aero Test Cell Beta',
          status: prediction.riskLevel === 'critical' ? 'critical' : prediction.riskLevel === 'high' ? 'degraded' : 'operational',
          criticality: cleanMachineId === 'MOTOR-003' ? 'critical' : 'high',
          downtimeCostPerHour: isMotor ? 3200 : 4500,
          notes: `Monitored industrial equipment streaming real-time IoT telemetry.`
        });
        await machine.save();
      } else {
        // Update machine status based on live prediction
        const oldStatus = machine.status;
        const newStatus = prediction.riskLevel === 'critical' ? 'critical' : prediction.riskLevel === 'high' ? 'degraded' : 'operational';
        if (oldStatus !== newStatus) {
          machine.status = newStatus;
          await machine.save();
          await notificationService.dispatchEvent('MACHINE_STATUS_CHANGED', {
            machineId: cleanMachineId,
            oldStatus,
            newStatus,
            criticality: machine.criticality
          });
        }
      }

      // 2. Persist prediction record matching Prediction Mongoose schema
      const predId = `PRED-SIM-${cleanMachineId}-${Date.now()}`;
      const riskLevelLower = (prediction.riskLevel || 'low').toLowerCase();
      const riskLevelUpper = riskLevelLower.toUpperCase();
      const riskProb = prediction.riskProbability ?? (riskLevelLower === 'critical' ? 0.95 : riskLevelLower === 'high' ? 0.65 : 0.15);

      const predictionRecord = new Prediction({
        predictionId: predId,
        machineId: cleanMachineId,
        predictionType: isMotor ? 'failure_risk_classification' : 'rul_regression',
        predictionResult: {
          riskProbability: riskProb,
          riskLevel: riskLevelLower,
          healthScore: prediction.healthScore ?? 85,
          estimatedRULDays: prediction.estimatedRULDays ?? prediction.predictedRUL ?? null,
          suspectedFailureMode: prediction.suspectedFailureMode || (isMotor ? 'Normal baseline' : 'Turbine blade clearance erosion'),
          recommendedAction: prediction.recommendedAction || 'Routine condition monitoring',
          confidence: prediction.confidence || 0.92
        },
        modelVersion: modelMetadata.modelVersion || (isMotor ? 'predictx-industrial-iot-v2.0' : 'xgb_regressor_FD001'),
        isMock: false,
        executionSource: 'ml_service_fastapi',
        inputFeatures: cleanedSensors || {},
        predictedRisk: riskLevelUpper,
        maintenancePriority: riskLevelUpper,
        reviewStatus: riskLevelUpper === 'CRITICAL' ? 'PENDING' : 'REVIEWED'
      });
      await predictionRecord.save();

      // 3. Persist latest sensor log snapshot with validated physical fields
      const airT = cleanedSensors.temperature ? (cleanedSensors.temperature + 273.15 - 12.0) : (cleanedSensors.s_2 || 298.15);
      const procT = cleanedSensors.temperature ? (cleanedSensors.temperature + 273.15) : (cleanedSensors.s_3 || 308.65);
      const speed = cleanedSensors.rpm || cleanedSensors.s_9 || 1485.0;
      const trq = cleanedSensors.torque || cleanedSensors.s_14 || 38.5;
      const vib = cleanedSensors.vibration !== undefined ? cleanedSensors.vibration : (cleanedSensors.s_4 ? cleanedSensors.s_4 / 700.0 : 1.5);
      const press = cleanedSensors.pressure !== undefined ? cleanedSensors.pressure : (cleanedSensors.s_7 ? cleanedSensors.s_7 / 14.5038 : 4.2);

      const sensorDoc = new SensorLog({
        machineId: cleanMachineId,
        timestamp: new Date(),
        airTemperature: Math.round(airT * 100) / 100,
        processTemperature: Math.round(procT * 100) / 100,
        rotationalSpeed: Math.round(speed),
        torque: Math.round(trq * 10) / 10,
        toolWear: cycle || 1,
        vibration: Math.round(vib * 100) / 100,
        pressureBar: Math.round(press * 100) / 100
      });
      await sensorDoc.save();

      // 4. Dispatch Alert if Critical or High Risk
      if (prediction.riskLevel === 'critical') {
        await notificationService.dispatchEvent('ANOMALY_DETECTED', {
          machineId: cleanMachineId,
          riskLevel: 'critical',
          predictedRUL: prediction.predictedRUL,
          suspectedFault: prediction.suspectedFailureMode,
          recommendedAction: prediction.recommendedAction
        });
      }

      return {
        synced: true,
        machineId: cleanMachineId,
        status: machine.status,
        predictionId: predictionRecord._id
      };
    } catch (err) {
      console.warn(`[SimulationService] syncSimulationPrediction warning: ${err.message}`);
      return { synced: false, error: err.message };
    }
  }

  async ensureDemoMachinesRegistered() {
    try {
      const demoFleet = [
        { id: 'MOTOR-001', name: 'Centrifugal Water Pump Motor', type: 'PUMP', crit: 'medium', status: 'operational' },
        { id: 'MOTOR-002', name: 'CNC Extruder Spindle Motor', type: 'MOTOR', crit: 'high', status: 'degraded' },
        { id: 'MOTOR-003', name: 'Gas Booster Compressor Motor', type: 'COMPRESSOR', crit: 'critical', status: 'critical' },
        { id: 'ENGINE-001', name: 'Turbofan Engine 001 (FD001 Nominal)', type: 'TURBINE', crit: 'medium', status: 'operational' },
        { id: 'ENGINE-002', name: 'Turbofan Engine 002 (FD001 Degrading)', type: 'TURBINE', crit: 'high', status: 'degraded' },
        { id: 'ENGINE-003', name: 'Turbofan Engine 003 (FD002 Multi-Regime)', type: 'TURBINE', crit: 'critical', status: 'critical' }
      ];

      for (const m of demoFleet) {
        const exists = await Machine.findOne({ machineId: m.id });
        if (!exists) {
          await Machine.create({
            machineId: m.id,
            name: m.name,
            machineType: m.type,
            location: m.id.startsWith('MOTOR') ? 'Plant Bay 4 - Rotating Line' : 'Aerospace Cell 4',
            status: m.status,
            criticality: m.crit,
            downtimeCostPerHour: m.id.startsWith('MOTOR') ? 3200 : 5000,
            notes: 'Registered IoT monitored equipment.'
          });
        }
      }
    } catch (e) {
      // Ignore during test environments without mongo
    }
  }
}

export const simulationService = new SimulationService();
export default simulationService;
