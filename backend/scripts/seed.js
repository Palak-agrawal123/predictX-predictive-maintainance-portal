import { connectDB, disconnectDB } from '../src/config/db.js';
import { Machine } from '../src/models/Machine.js';
import { Prediction } from '../src/models/Prediction.js';
import { WorkOrder } from '../src/models/WorkOrder.js';
import { SensorLog } from '../src/models/SensorLog.js';
import { ModelEvaluation } from '../src/models/ModelEvaluation.js';

const DEMO_MACHINES = [
  {
    machineId: 'MCH-CNC-101',
    name: 'CNC High-Speed Milling Center Alpha',
    machineType: 'CNC_MILL',
    location: 'Sector A - Machining Bay 1',
    status: 'operational',
    criticality: 'critical',
    downtimeCostPerHour: 4500,
    operatingParameters: {
      airTempKelvin: 298.5,
      processTempKelvin: 308.7,
      rotationalSpeedRpm: 1550,
      torqueNm: 42.8,
      toolWearMinutes: 45,
      vibrationMmS: 1.8
    },
    lastMaintenanceDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    notes: 'Precision 5-axis CNC mill for titanium aerospace components. Critical production asset.'
  },
  {
    machineId: 'MCH-HYD-202',
    name: 'Hydraulic Stamping Press 500-Ton',
    machineType: 'HYDRAULIC_PRESS',
    location: 'Sector B - Heavy Press Shop',
    status: 'degraded',
    criticality: 'high',
    downtimeCostPerHour: 3200,
    operatingParameters: {
      airTempKelvin: 301.2,
      processTempKelvin: 314.5,
      rotationalSpeedRpm: 1320,
      torqueNm: 58.4,
      toolWearMinutes: 185,
      vibrationMmS: 3.9
    },
    lastMaintenanceDate: new Date(Date.now() - 72 * 24 * 60 * 60 * 1000),
    notes: 'High tool wear and thermal gradient detected. Requires seal inspection.'
  },
  {
    machineId: 'MCH-TUR-303',
    name: 'Industrial Gas Turbine Generator Gen-3',
    machineType: 'TURBINE',
    location: 'Sector C - Power Plant & Cogeneration',
    status: 'critical',
    criticality: 'critical',
    downtimeCostPerHour: 8500,
    operatingParameters: {
      airTempKelvin: 304.8,
      processTempKelvin: 322.1,
      rotationalSpeedRpm: 2850,
      torqueNm: 68.2,
      toolWearMinutes: 228,
      vibrationMmS: 5.6
    },
    lastMaintenanceDate: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000),
    notes: 'High vibration and elevated temperature gradient. Potential bearing overstrain.'
  },
  {
    machineId: 'MCH-ROB-404',
    name: '6-Axis Articulated Welding Robot',
    machineType: 'ROBOTIC_ARM',
    location: 'Sector A - Automated Chassis Assembly',
    status: 'operational',
    criticality: 'medium',
    downtimeCostPerHour: 1800,
    operatingParameters: {
      airTempKelvin: 297.0,
      processTempKelvin: 304.5,
      rotationalSpeedRpm: 1420,
      torqueNm: 36.1,
      toolWearMinutes: 30,
      vibrationMmS: 1.4
    },
    lastMaintenanceDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    notes: 'Recently serviced and calibrated. Operating within nominal specs.'
  },
  {
    machineId: 'MCH-PMP-505',
    name: 'High-Pressure Centrifugal Slurry Pump',
    machineType: 'CENTRIFUGAL_PUMP',
    location: 'Sector D - Chemical Processing Line',
    status: 'operational',
    criticality: 'high',
    downtimeCostPerHour: 2800,
    operatingParameters: {
      airTempKelvin: 299.1,
      processTempKelvin: 307.8,
      rotationalSpeedRpm: 1780,
      torqueNm: 39.5,
      toolWearMinutes: 82,
      vibrationMmS: 2.1
    },
    lastMaintenanceDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    notes: 'Continuous duty fluid transfer pump. Slurry density monitoring normal.'
  },
  {
    machineId: 'MCH-CMP-606',
    name: 'Rotary Screw Air Compressor Unit 2',
    machineType: 'COMPRESSOR',
    location: 'Sector E - Plant Utilities & Pneumatics',
    status: 'maintenance',
    criticality: 'low',
    downtimeCostPerHour: 950,
    operatingParameters: {
      airTempKelvin: 296.5,
      processTempKelvin: 302.0,
      rotationalSpeedRpm: 1200,
      torqueNm: 28.0,
      toolWearMinutes: 10,
      vibrationMmS: 1.1
    },
    lastMaintenanceDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    notes: 'Undergoing routine oil filter and separator cartridge replacement.'
  }
];

async function seedDatabase() {
  console.log('[Seed] Starting database seed for Predictive Maintenance Portal...');
  await connectDB();

  try {
    // 1. Clear existing collections
    console.log('[Seed] Clearing existing demo data...');
    await Promise.all([
      Machine.deleteMany({}),
      Prediction.deleteMany({}),
      WorkOrder.deleteMany({}),
      SensorLog.deleteMany({}),
      ModelEvaluation.deleteMany({})
    ]);

    // 2. Insert Machines
    console.log('[Seed] Inserting demo machines...');
    const createdMachines = await Machine.insertMany(DEMO_MACHINES);
    console.log(`[Seed] Inserted ${createdMachines.length} demo machines.`);

    // 3. Generate Time-series Sensor Logs for each machine (last 24 hours)
    console.log('[Seed] Generating time-series telemetry sensor logs...');
    const sensorLogs = [];
    const now = Date.now();

    for (const machine of DEMO_MACHINES) {
      const p = machine.operatingParameters;
      const isCritical = machine.status === 'critical';
      const isDegraded = machine.status === 'degraded';

      for (let i = 24; i >= 0; i--) {
        const timestamp = new Date(now - i * 60 * 60 * 1000);
        // Trend factors over time
        const wearProgression = isCritical ? (24 - i) * 3 : (24 - i) * 0.5;
        const tempDrift = isCritical ? (24 - i) * 0.4 : (24 - i) * 0.05;
        const vibNoise = (Math.random() - 0.5) * 0.4;

        sensorLogs.push({
          machineId: machine.machineId,
          timestamp,
          airTemperature: Number((p.airTempKelvin + (Math.random() - 0.5) * 1.5).toFixed(1)),
          processTemperature: Number((p.processTempKelvin + tempDrift + (Math.random() - 0.5) * 1.0).toFixed(1)),
          rotationalSpeed: Math.round(p.rotationalSpeedRpm + (Math.random() - 0.5) * 50),
          torque: Number((p.torqueNm + (Math.random() - 0.5) * 3).toFixed(1)),
          toolWear: Math.round(Math.max(0, p.toolWearMinutes - (i * 2) + wearProgression)),
          vibration: Number(Math.max(0.5, p.vibrationMmS + (isCritical ? (24 - i) * 0.1 : 0) + vibNoise).toFixed(2)),
          pressureBar: Number((3.5 + (Math.random() - 0.5) * 0.3).toFixed(2))
        });
      }
    }

    await SensorLog.insertMany(sensorLogs);
    console.log(`[Seed] Inserted ${sensorLogs.length} historical sensor telemetry logs.`);

    // 4. Insert Benchmark Model Evaluation Data
    console.log('[Seed] Inserting ML model evaluation benchmark results...');
    await ModelEvaluation.create({
      modelName: 'XGBoost Industrial Failure Classifier',
      modelVersion: 'xgb-ai4i-v1.2.0',
      dataset: 'UCI AI4I 2020 Predictive Maintenance Dataset',
      taskType: 'binary_classification',
      metrics: {
        accuracy: 0.984,
        precision: 0.872,
        recall: 0.795,
        f1Score: 0.831,
        rocAuc: 0.976
      },
      sampleCount: 10000,
      failureModesEvaluated: [
        'Tool Wear Failure (TWF)',
        'Heat Dissipation Failure (HDF)',
        'Power Failure (PWF)',
        'Overstrain Failure (OSF)',
        'Random Failures (RNF)'
      ],
      featureImportance: [
        { feature: 'Torque_Nm', importance: 0.312 },
        { feature: 'Tool_wear_min', importance: 0.245 },
        { feature: 'temp_diff', importance: 0.187 },
        { feature: 'Rotational_speed_rpm', importance: 0.142 },
        { feature: 'Process_temperature_K', importance: 0.068 },
        { feature: 'Air_temperature_K', importance: 0.046 }
      ],
      evaluatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      notes: 'Evaluated using 5-fold stratified cross-validation on 10,000 production tool wear samples.'
    });

    // 5. Insert Sample Predictions
    console.log('[Seed] Inserting initial prediction records...');
    const samplePredictions = [
      {
        predictionId: 'PRD-DEMO-001',
        machineId: 'MCH-TUR-303',
        predictionType: 'failure_risk_classification',
        predictionResult: {
          riskProbability: 0.895,
          riskLevel: 'critical',
          healthScore: 11,
          estimatedRULDays: 3,
          suspectedFailureMode: 'Tool Wear Failure (TWF) & Overstrain',
          recommendedAction: 'IMMEDIATE ACTION: Halt machine spindle and replace bearing and cutting insert.',
          confidence: 0.94
        },
        modelVersion: 'xgb-ai4i-v1.2.0',
        isMock: false,
        executionSource: 'ml_service_fastapi',
        inputFeatures: DEMO_MACHINES[2].operatingParameters,
        predictionTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        predictionId: 'PRD-DEMO-002',
        machineId: 'MCH-HYD-202',
        predictionType: 'failure_risk_classification',
        predictionResult: {
          riskProbability: 0.642,
          riskLevel: 'high',
          healthScore: 36,
          estimatedRULDays: 12,
          suspectedFailureMode: 'Heat Dissipation Failure (HDF)',
          recommendedAction: 'ACTION: Temperature differential is degraded. Clean cooling vents within 48 hours.',
          confidence: 0.88
        },
        modelVersion: 'xgb-ai4i-v1.2.0',
        isMock: false,
        executionSource: 'ml_service_fastapi',
        inputFeatures: DEMO_MACHINES[1].operatingParameters,
        predictionTimestamp: new Date(Date.now() - 4 * 60 * 60 * 1000)
      },
      {
        predictionId: 'PRD-DEMO-003',
        machineId: 'MCH-CNC-101',
        predictionType: 'failure_risk_classification',
        predictionResult: {
          riskProbability: 0.078,
          riskLevel: 'low',
          healthScore: 92,
          estimatedRULDays: 60,
          suspectedFailureMode: 'None',
          recommendedAction: 'Standard routine operation. No intervention required.',
          confidence: 0.96
        },
        modelVersion: 'xgb-ai4i-v1.2.0',
        isMock: false,
        executionSource: 'ml_service_fastapi',
        inputFeatures: DEMO_MACHINES[0].operatingParameters,
        predictionTimestamp: new Date(Date.now() - 6 * 60 * 60 * 1000)
      }
    ];

    await Prediction.insertMany(samplePredictions);

    // 6. Insert Work Orders
    console.log('[Seed] Inserting initial work orders...');
    const sampleWorkOrders = [
      {
        workOrderId: 'WO-01001',
        machineId: 'MCH-TUR-303',
        predictionId: 'PRD-DEMO-001',
        title: 'Emergency Bearing and Tool Wear Replacement',
        description: 'ML model detected critical failure probability (89.5%) with excessive vibration (5.6 mm/s). Immediate bearing inspection required.',
        priority: 'urgent',
        status: 'approved',
        assignedTo: 'Vikram Singh (Lead Mechanical Engineer)',
        scheduledDate: new Date(Date.now() + 12 * 60 * 60 * 1000)
      },
      {
        workOrderId: 'WO-01002',
        machineId: 'MCH-HYD-202',
        predictionId: 'PRD-DEMO-002',
        title: 'Hydraulic Heat Exchanger Flushing',
        description: 'Thermal dissipation degradation detected. Inspect hydraulic radiator, coolant lines, and flush sediment.',
        priority: 'high',
        status: 'draft',
        assignedTo: 'Priya Sharma (Maintenance Tech)',
        scheduledDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
      },
      {
        workOrderId: 'WO-01003',
        machineId: 'MCH-CMP-606',
        title: 'Scheduled 500-Hour Oil & Separator Overhaul',
        description: 'Routine scheduled preventative maintenance cycle as per OEM maintenance manual.',
        priority: 'low',
        status: 'in_progress',
        assignedTo: 'Amit Kumar (Plant Tech)',
        scheduledDate: new Date(Date.now())
      }
    ];

    await WorkOrder.insertMany(sampleWorkOrders);
    console.log('[Seed] Database seed completed successfully!');

  } catch (err) {
    console.error('[Seed Error] Failed to seed database:', err);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

seedDatabase();
