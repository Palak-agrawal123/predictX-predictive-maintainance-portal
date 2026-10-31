/**
 * Shared Simulation Data Service & Telemetry Generator
 * Powers both /sensor-simulator and the main /dashboard in real time.
 */

export function buildComparisonTableIndustrial(raw = {}, clean = {}) {
  const meta = [
    { key: 'temperature', name: 'Machine Temperature', unit: '°C' },
    { key: 'vibration', name: 'Vibration Amplitude', unit: 'mm/s' },
    { key: 'rpm', name: 'Rotational Speed', unit: 'RPM' },
    { key: 'pressure', name: 'Operating Pressure', unit: 'bar' },
    { key: 'current', name: 'Motor Current', unit: 'A' },
    { key: 'voltage', name: 'Supply Voltage', unit: 'V' },
    { key: 'torque', name: 'Drive Torque', unit: 'Nm' }
  ];
  return meta.map(m => {
    const rVal = raw[m.key];
    const cVal = clean[m.key];
    const diff = rVal !== null && cVal !== null && rVal !== undefined && cVal !== undefined ? +(rVal - cVal).toFixed(2) : 0;
    const isOutlier = Math.abs(diff) > (m.key === 'vibration' ? 0.4 : m.key === 'rpm' ? 15 : 0.8);
    const isImputed = rVal === null || rVal === undefined;
    return {
      sensor_key: m.key,
      name: m.name,
      unit: m.unit,
      raw_value: rVal,
      cleaned_value: cVal,
      diff,
      action: isOutlier ? 'Median Filter (Spike Attenuation)' : isImputed ? 'EMA Imputed (Gap Filled)' : Math.abs(diff) > 0.02 ? 'EMA Filtered (Noise Reduction)' : 'Preserved (Nominal)',
      status: isOutlier ? 'Outlier Corrected' : isImputed ? 'Imputed' : 'Valid',
      is_outlier: isOutlier,
      is_imputed: isImputed
    };
  });
}

export function buildComparisonTableTurbofan(raw = {}, clean = {}) {
  const meta = [
    { key: 's_2', name: 'T24 LPC Outlet Temp', unit: '°R' },
    { key: 's_3', name: 'T30 HPC Outlet Temp', unit: '°R' },
    { key: 's_4', name: 'T50 LPT Coolant Temp', unit: '°R' },
    { key: 's_7', name: 'P30 HPC Pressure', unit: 'psia' },
    { key: 's_11', name: 'Ps30 HPC Static Pressure', unit: 'psia' },
    { key: 's_12', name: 'Phi Fan Ratio', unit: 'ratio' },
    { key: 's_14', name: 'NRc Core Speed', unit: 'rpm' },
    { key: 's_15', name: 'BPR Bypass Ratio', unit: 'ratio' }
  ];
  return meta.map(m => {
    const rVal = raw[m.key];
    const cVal = clean[m.key];
    const diff = rVal !== null && cVal !== null && rVal !== undefined && cVal !== undefined ? +(rVal - cVal).toFixed(2) : 0;
    const isOutlier = Math.abs(diff) > (m.key === 's_4' ? 6.0 : 2.5);
    const isImputed = rVal === null || rVal === undefined;
    return {
      sensor_key: m.key,
      name: m.name,
      unit: m.unit,
      raw_value: rVal,
      cleaned_value: cVal,
      diff,
      action: isOutlier ? 'Regime Median Filter' : isImputed ? 'Spline Imputed' : 'EMA Smoothed',
      status: isOutlier ? 'Outlier Corrected' : isImputed ? 'Imputed' : 'Valid',
      is_outlier: isOutlier,
      is_imputed: isImputed
    };
  });
}

export function generateLivePacket(machineId, cycle, options = {}) {
  const { injectAnomalies = true, fleetMode = 'industrial' } = options;
  const isIndustrial = machineId.startsWith('MOTOR') || fleetMode === 'industrial';
  const now = new Date().toISOString();

  if (isIndustrial) {
    let clean = {};
    let raw = {};
    let healthScore = 98;
    let anomalyScore = 2;
    let riskLevel = 'low';
    let suspectedFailureMode = 'Normal Nominal Operation';
    let isoZone = 'Zone A (Good)';
    let recommendedAction = 'Continue routine scheduled condition monitoring.';
    let watts = 5980;

    if (machineId === 'MOTOR-001') {
      const t = cycle - 25;
      const cleanVib = +(1.38 + 0.05 * Math.sin(t * 0.35)).toFixed(2);
      const cleanTemp = +(46.2 + 0.3 * Math.sin(t * 0.2)).toFixed(1);
      const cleanRpm = +(1485 + Math.round(Math.cos(t * 0.25) * 3)).toFixed(0);
      const cleanPress = +(4.20 + 0.04 * Math.sin(t * 0.4)).toFixed(2);
      const cleanCurr = +(12.20 + 0.12 * Math.cos(t * 0.35)).toFixed(2);
      const cleanVolt = +(400.0 + 0.8 * Math.sin(t * 0.15)).toFixed(1);
      const cleanTorque = +(38.5 + 0.25 * Math.sin(t * 0.3)).toFixed(1);

      clean = {
        vibration: cleanVib,
        temperature: cleanTemp,
        rpm: Number(cleanRpm),
        pressure: cleanPress,
        current: cleanCurr,
        voltage: cleanVolt,
        torque: cleanTorque
      };

      const hasSpike = injectAnomalies && (cycle % 7 === 0);
      raw = {
        vibration: hasSpike ? +(cleanVib + 1.65).toFixed(2) : +(cleanVib + (Math.sin(t * 1.2) * 0.07)).toFixed(2),
        temperature: +(cleanTemp + (Math.cos(t * 0.6) * 0.2)).toFixed(1),
        rpm: hasSpike ? Number(cleanRpm) - 35 : Number(cleanRpm) + Math.round(Math.sin(t * 0.8) * 3),
        pressure: +(cleanPress + (Math.cos(t * 1.0) * 0.02)).toFixed(2),
        current: +(cleanCurr + (Math.sin(t * 0.7) * 0.12)).toFixed(2),
        voltage: +(cleanVolt + (Math.cos(t * 0.4) * 1.0)).toFixed(1),
        torque: +(cleanTorque + (Math.sin(t * 1.1) * 0.25)).toFixed(1)
      };

      healthScore = 98;
      anomalyScore = 2;
      riskLevel = 'low';
      isoZone = 'Zone A (Good)';
      suspectedFailureMode = 'Normal Nominal Operation';
      recommendedAction = 'Continue routine scheduled condition monitoring.';
      watts = 5980;
    } else if (machineId === 'MOTOR-002') {
      const t = cycle - 90;
      const progression = Math.min(1.0, Math.max(0, t / 40));
      const cleanVib = +(3.75 + progression * 0.6 + 0.12 * Math.sin(t * 0.4)).toFixed(2);
      const cleanTemp = +(63.5 + progression * 3.5 + 0.4 * Math.sin(t * 0.3)).toFixed(1);
      const cleanRpm = +(1750 - Math.round(progression * 15) + Math.round(Math.cos(t * 0.3) * 4)).toFixed(0);
      const cleanPress = +(5.15 + progression * 0.25).toFixed(2);
      const cleanCurr = +(16.8 + progression * 1.8).toFixed(2);
      const cleanVolt = +(399.0 + 1.2 * Math.sin(t * 0.3)).toFixed(1);
      const cleanTorque = +(43.0 + progression * 3.5).toFixed(1);

      clean = {
        vibration: cleanVib,
        temperature: cleanTemp,
        rpm: Number(cleanRpm),
        pressure: cleanPress,
        current: cleanCurr,
        voltage: cleanVolt,
        torque: cleanTorque
      };

      const hasSpike = injectAnomalies && (cycle % 6 === 0);
      raw = {
        vibration: hasSpike ? +(cleanVib + 2.2).toFixed(2) : +(cleanVib + (Math.sin(t * 1.3) * 0.25)).toFixed(2),
        temperature: +(cleanTemp + (Math.cos(t * 0.7) * 0.4)).toFixed(1),
        rpm: hasSpike ? Number(cleanRpm) - 55 : Number(cleanRpm) + Math.round(Math.sin(t * 1.0) * 6),
        pressure: +(cleanPress + (Math.cos(t * 0.8) * 0.06)).toFixed(2),
        current: +(cleanCurr + (Math.sin(t * 0.6) * 0.25)).toFixed(2),
        voltage: +(cleanVolt + (Math.cos(t * 0.5) * 1.4)).toFixed(1),
        torque: +(cleanTorque + (Math.sin(t * 0.8) * 0.45)).toFixed(1)
      };

      healthScore = Math.max(50, Math.round(68 - progression * 10));
      anomalyScore = Math.min(50, Math.round(32 + progression * 10));
      riskLevel = 'medium';
      isoZone = 'Zone B/C (Restricted)';
      suspectedFailureMode = 'Bearing Raceway Wear & 1x Harmonic Drift';
      recommendedAction = 'Schedule bearing lubrication and vibration FFT check on next shift.';
      watts = 7850;
    } else {
      // MOTOR-003 (Critical)
      const t = cycle - 165;
      const progression = Math.min(1.0, Math.max(0, t / 35));
      const cleanVib = +(7.45 + progression * 1.1 + 0.2 * Math.sin(t * 0.5)).toFixed(2);
      const cleanTemp = +(88.5 + progression * 4.5 + 0.6 * Math.sin(t * 0.3)).toFixed(1);
      const cleanRpm = +(2935 - Math.round(progression * 30) + Math.round(Math.cos(t * 0.4) * 7)).toFixed(0);
      const cleanPress = +(8.25 + progression * 0.4).toFixed(2);
      const cleanCurr = +(31.0 + progression * 3.5).toFixed(2);
      const cleanVolt = +(395.0 + 2.0 * Math.sin(t * 0.4)).toFixed(1);
      const cleanTorque = +(68.0 + progression * 5.0).toFixed(1);

      clean = {
        vibration: cleanVib,
        temperature: cleanTemp,
        rpm: Number(cleanRpm),
        pressure: cleanPress,
        current: cleanCurr,
        voltage: cleanVolt,
        torque: cleanTorque
      };

      const hasSpike = injectAnomalies && (cycle % 5 === 0);
      raw = {
        vibration: hasSpike ? +(cleanVib + 2.8).toFixed(2) : +(cleanVib + (Math.sin(t * 1.5) * 0.38)).toFixed(2),
        temperature: +(cleanTemp + (Math.cos(t * 0.8) * 0.9)).toFixed(1),
        rpm: hasSpike ? Number(cleanRpm) - 95 : Number(cleanRpm) + Math.round(Math.sin(t * 1.1) * 11),
        pressure: +(cleanPress + (Math.cos(t * 0.6) * 0.12)).toFixed(2),
        current: +(cleanCurr + (Math.sin(t * 0.5) * 0.65)).toFixed(2),
        voltage: +(cleanVolt + (Math.cos(t * 0.7) * 2.2)).toFixed(1),
        torque: +(cleanTorque + (Math.sin(t * 0.4) * 0.9)).toFixed(1)
      };

      healthScore = Math.max(12, Math.round(24 - progression * 8));
      anomalyScore = Math.min(88, Math.round(76 + progression * 8));
      riskLevel = 'critical';
      isoZone = 'Zone D (Trip Dangerous)';
      suspectedFailureMode = 'Severe Bearing Cage Breakdown & Thermal Runaway';
      recommendedAction = 'EMERGENCY TRIP: Lock-out and inspect compressor bearing housing immediately.';
      watts = 21350;
    }

    const comparison_table = buildComparisonTableIndustrial(raw, clean);

    return {
      type: 'telemetry_tick',
      machine_id: machineId,
      machine_name:
        machineId === 'MOTOR-001'
          ? 'Centrifugal Water Pump Motor'
          : machineId === 'MOTOR-002'
          ? 'CNC Extruder Spindle Motor'
          : 'Gas Booster Compressor Motor',
      machine_type: machineId === 'MOTOR-003' ? 'COMPRESSOR_MOTOR' : 'PUMP_MOTOR',
      cycle,
      timestamp: now,
      source: 'simulated_sensor',
      raw_sensors: raw,
      cleaned_sensors: clean,
      quality_status: 'VALID',
      data_quality_flags: [],
      comparison_table,
      prediction: {
        has_prediction: true,
        healthScore,
        riskLevel,
        anomalyScore,
        suspectedFailureMode,
        recommendedAction,
        physicsMetrics: {
          isoZone,
          mechanicalPowerWatts: watts
        }
      },
      model_metadata: {
        model_name: 'ISO 10816-3 & XGBoost Prognostics',
        version: '2.1.0',
        features_used: ['temperature', 'vibration', 'rpm', 'pressure', 'current', 'voltage', 'torque']
      }
    };
  } else {
    // Turbofan Engine (C-MAPSS)
    let clean = {};
    let raw = {};
    let predictedRUL = 120;
    let healthScore = 98;
    let riskLevel = 'low';

    if (machineId === 'Engine-001') {
      const t = cycle - 25;
      clean = {
        s_2: +(642.1 + 0.2 * Math.sin(t * 0.3)).toFixed(2),
        s_3: +(1586.5 + 1.2 * Math.cos(t * 0.2)).toFixed(2),
        s_4: +(1402.4 + 1.5 * Math.sin(t * 0.4)).toFixed(2),
        s_7: +(553.8 + 0.4 * Math.cos(t * 0.5)).toFixed(2),
        s_11: +(47.32 + 0.05 * Math.sin(t * 0.6)).toFixed(2),
        s_12: +(521.6 + 0.2 * Math.cos(t * 0.4)).toFixed(2),
        s_14: +(8132 + Math.round(Math.sin(t * 0.3) * 6)).toFixed(0),
        s_15: +(8.42 + 0.02 * Math.cos(t * 0.5)).toFixed(4)
      };
      const hasSpike = injectAnomalies && (cycle % 8 === 0);
      raw = {
        ...clean,
        s_4: hasSpike ? +(clean.s_4 + 16.5).toFixed(2) : +(clean.s_4 + 0.8 * Math.cos(t * 0.9)).toFixed(2)
      };
      predictedRUL = Math.max(80, 120 - Math.round((cycle - 45) * 0.7));
      healthScore = 98;
      riskLevel = 'low';
    } else if (machineId === 'Engine-002') {
      const t = cycle - 90;
      const progression = Math.min(1.0, Math.max(0, t / 40));
      clean = {
        s_2: +(643.0 + progression * 1.5).toFixed(2),
        s_3: +(1592.0 + progression * 8.5).toFixed(2),
        s_4: +(1415.0 + progression * 18.0 + 2.0 * Math.sin(t * 0.4)).toFixed(2),
        s_7: +(552.4 - progression * 2.2).toFixed(2),
        s_11: +(47.10 - progression * 0.35).toFixed(2),
        s_12: +(521.2 - progression * 0.5).toFixed(2),
        s_14: +(8115 - Math.round(progression * 25)).toFixed(0),
        s_15: +(8.45 + progression * 0.06).toFixed(4)
      };
      const hasSpike = injectAnomalies && (cycle % 7 === 0);
      raw = {
        ...clean,
        s_4: hasSpike ? +(clean.s_4 + 24.0).toFixed(2) : +(clean.s_4 + 1.4 * Math.cos(t * 0.8)).toFixed(2)
      };
      predictedRUL = Math.max(20, 62 - Math.round((cycle - 110) * 0.8));
      healthScore = Math.max(45, Math.round(68 - progression * 12));
      riskLevel = 'medium';
    } else {
      const t = cycle - 165;
      const progression = Math.min(1.0, Math.max(0, t / 35));
      clean = {
        s_2: +(644.5 + progression * 2.8).toFixed(2),
        s_3: +(1604.0 + progression * 14.0).toFixed(2),
        s_4: +(1438.0 + progression * 22.0 + 3.0 * Math.sin(t * 0.5)).toFixed(2),
        s_7: +(550.2 - progression * 4.0).toFixed(2),
        s_11: +(46.85 - progression * 0.6).toFixed(2),
        s_12: +(520.4 - progression * 1.1).toFixed(2),
        s_14: +(8085 - Math.round(progression * 45)).toFixed(0),
        s_15: +(8.51 + progression * 0.12).toFixed(4)
      };
      const hasSpike = injectAnomalies && (cycle % 5 === 0);
      raw = {
        ...clean,
        s_4: hasSpike ? +(clean.s_4 + 35.0).toFixed(2) : +(clean.s_4 + 2.2 * Math.cos(t * 0.7)).toFixed(2)
      };
      predictedRUL = Math.max(2, 22 - Math.round((cycle - 185) * 1.0));
      healthScore = Math.max(8, Math.round(24 - progression * 10));
      riskLevel = 'critical';
    }

    const comparison_table = buildComparisonTableTurbofan(raw, clean);

    return {
      type: 'telemetry_tick',
      machine_id: machineId,
      machine_name: machineId,
      cycle,
      timestamp: now,
      source: 'simulated_sensor',
      raw_sensors: raw,
      cleaned_sensors: clean,
      quality_status: 'VALID',
      comparison_table,
      prediction: {
        has_prediction: true,
        predictedRUL,
        healthScore,
        riskLevel,
        anomalyScore: 100 - healthScore,
        suspectedFailureMode:
          machineId === 'Engine-003'
            ? 'HPC & HPT Degradation'
            : machineId === 'Engine-002'
            ? 'Fan Blade Erosion'
            : 'Nominal Flight Cycles',
        recommendedAction:
          machineId === 'Engine-003'
            ? 'Overhaul required within 20 cycles.'
            : machineId === 'Engine-002'
            ? 'Inspect HPC borescope on next B-check.'
            : 'Continue scheduled flight operations.'
      },
      model_metadata: {
        model_name: machineId === 'Engine-003' ? 'Attention-CNN-BiLSTM (FD002)' : 'XGBoost Regressor (FD001)',
        version: '2.1.0',
        features_used: ['s_2', 's_3', 's_4', 's_7', 's_11', 's_12', 's_14', 's_15']
      }
    };
  }
}

export function generateDemonstrationFleetData() {
  const history = {};
  const latestFrames = {};
  const machineConfigs = [
    { id: 'MOTOR-001', baseCycle: 26, count: 20 },
    { id: 'MOTOR-002', baseCycle: 91, count: 20 },
    { id: 'MOTOR-003', baseCycle: 166, count: 20 },
    { id: 'Engine-001', baseCycle: 26, count: 20 },
    { id: 'Engine-002', baseCycle: 91, count: 20 },
    { id: 'Engine-003', baseCycle: 166, count: 20 }
  ];

  machineConfigs.forEach(({ id, baseCycle, count }) => {
    const pkts = Array.from({ length: count }, (_, i) => {
      const cycle = baseCycle + i;
      return generateLivePacket(id, cycle, {
        injectAnomalies: true,
        fleetMode: id.startsWith('MOTOR') ? 'industrial' : 'turbofan'
      });
    });
    history[id] = pkts;
    latestFrames[id] = pkts[pkts.length - 1];
  });

  return { history, latestFrames };
}

export const INITIAL_FLEET_DATA = generateDemonstrationFleetData();

/**
 * Converts a simulation telemetry packet into a Machine object for Dashboard & Fleet Ranking
 */
export function packetToFleetMachine(packet) {
  if (!packet) return null;
  const mid = packet.machine_id;
  const pred = packet.prediction || {};
  const cleanSensors = packet.cleaned_sensors || {};
  const isMotor = mid.startsWith('MOTOR');

  const riskLevel = (pred.riskLevel || 'low').toLowerCase();
  const status = riskLevel === 'critical' ? 'Critical' : riskLevel === 'medium' || riskLevel === 'high' ? 'Degraded' : 'Operational';
  const riskScore = pred.anomalyScore ?? (100 - (pred.healthScore || 90));
  const healthScore = pred.healthScore ?? (100 - riskScore);
  const predictedRul = pred.predictedRUL ?? (mid === 'MOTOR-003' ? 18 : mid === 'MOTOR-002' ? 74 : 195);

  return {
    id: mid,
    machineId: mid,
    name: packet.machine_name || mid,
    type: isMotor ? 'Rotating Industrial Motor' : 'Aero Turbofan Engine',
    line: isMotor ? 'Extrusion & Pumping Bay 1' : 'Aero Test Cell Alpha',
    status,
    criticality: mid === 'MOTOR-003' || mid === 'Engine-003' ? 'Critical' : 'High',
    criticalityScore: mid === 'MOTOR-003' ? 95 : mid === 'MOTOR-002' ? 82 : 60,
    healthScore,
    riskScore,
    riskLevel: riskLevel === 'critical' ? 'Critical' : riskLevel === 'medium' || riskLevel === 'high' ? 'Warning' : 'Healthy',
    productionImpact: mid === 'MOTOR-003' ? 92 : mid === 'MOTOR-002' ? 68 : 45,
    urgency: riskScore,
    predictedRul,
    rulUnit: isMotor ? 'hours' : 'cycles',
    currentCycle: packet.cycle || 45,
    operatingHours: (packet.cycle || 45) * 12 + 1420,
    predictedFault: pred.suspectedFailureMode || 'Nominal Operation',
    recommendedAction: pred.recommendedAction || 'Continue routine condition monitoring',
    sensors: cleanSensors,
    isSimulated: true,
    lastUpdate: packet.timestamp || new Date().toISOString()
  };
}

/**
 * Get all simulation machines for dashboard list
 */
export function getSimulatedFleetMachines(latestFrames = {}) {
  const frames = { ...INITIAL_FLEET_DATA.latestFrames, ...latestFrames };
  return Object.values(frames).map(packetToFleetMachine).filter(Boolean);
}
