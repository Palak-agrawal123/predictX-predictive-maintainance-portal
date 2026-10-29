/**
 * Dataset for registered industrial machines.
 * Domain: Manufacturing & Turbofan/Rotary equipment inspired by NASA C-MAPSS dataset.
 * Authentic thermodynamic and mechanical sensor parameters.
 */
export const initialMachines = [
  {
    id: "MC-7801",
    name: "Turbofan Engine Unit #01 (C-MAPSS)",
    type: "Turbofan Engine",
    line: "Test Cell Alpha",
    status: "Operational", // Operational, Degraded, Under Maintenance, Offline
    criticality: "High",   // Low, Medium, High, Critical
    criticalityScore: 90,
    healthScore: 46,      // 0 - 100
    riskScore: 54,        // 0 - 100
    riskLevel: "Warning",  // Healthy, Warning, Critical
    productionImpact: 85,  // 0 - 100
    urgency: 75,           // 0 - 100
    predictedRul: 48,      // cycles
    rulUnit: "cycles",
    lastMaintenance: "2026-09-14",
    nextScheduled: "2026-11-05",
    operatingHours: 4210,
    currentCycle: 215,
    topFactors: [
      { name: "s11 (Ps30 Static Pressure HPC) drift", value: 78, category: "Pressure", status: "critical" },
      { name: "s4 (T50 Total Temp LPT) thermal gradient", value: 68, category: "Thermal", status: "warning" },
      { name: "s8 (Nf Physical Fan Speed) harmonic variance", value: 54, category: "Dynamics", status: "warning" },
      { name: "s2 (T24 Total Temp LPC) nominal baseline", value: 42, category: "Thermal", status: "normal" }
    ],
    breakdownSensors: [
      { name: "Pressure Dynamics (Ps30)", value: 78, color: "#38BDF8" },
      { name: "Thermal Gradient (T50)", value: 68, color: "#FF5B64" },
      { name: "Fan Dynamics (Nf)", value: 54, color: "#F5B942" },
      { name: "LPC Baseline (T24)", value: 42, color: "#43D17D" }
    ],
    predictedFault: "High-Pressure Turbine (HPT) blade clearance erosion & thermal degradation",
    dataSource: "NASA C-MAPSS FD001 Subsample Replay",
    dataQuality: "Good (100% telemetry freshness)",
    qualityFlags: []
  },
  {
    id: "MC-8210",
    name: "Robotic Welder K-400",
    type: "Industrial Robot",
    line: "Chassis Welding Cell B",
    status: "Degraded",
    criticality: "Critical",
    criticalityScore: 95,
    healthScore: 24,
    riskScore: 76,
    riskLevel: "Critical",
    productionImpact: 95,
    urgency: 90,
    predictedRul: 14,
    rulUnit: "cycles",
    lastMaintenance: "2026-08-02",
    nextScheduled: "2026-10-30",
    operatingHours: 6830,
    currentCycle: 342,
    topFactors: [
      { name: "Axis 3 Servo current draw anomaly (+34%)", value: 88, category: "Electrical", status: "critical" },
      { name: "Joint gear backlash vibration amplitude", value: 74, category: "Vibration", status: "critical" },
      { name: "Weld tip coolant temperature variance", value: 62, category: "Thermal", status: "warning" }
    ],
    breakdownSensors: [
      { name: "Vibration Dynamics", value: 88, color: "#FF5B64" },
      { name: "Servo Current Draw", value: 74, color: "#F5B942" },
      { name: "Coolant Thermal State", value: 62, color: "#FF805F" },
      { name: "Bearing Lubrication", value: 45, color: "#43D17D" }
    ],
    predictedFault: "Axis 3 harmonic reducer bearing imminent fatigue",
    dataSource: "Sensor Telemetry Replay",
    dataQuality: "Warning (High vibration harmonics at 11:42)",
    qualityFlags: ["Vibration amplitude 7.8 mm/s exceeding ISO 10816 limit"]
  },
  {
    id: "MC-4402",
    name: "Hydraulic Stamping Press 500T",
    type: "Hydraulic Press",
    line: "Stamping Bay 2",
    status: "Operational",
    criticality: "High",
    criticalityScore: 80,
    healthScore: 82,
    riskScore: 18,
    riskLevel: "Healthy",
    productionImpact: 70,
    urgency: 25,
    predictedRul: 180,
    rulUnit: "cycles",
    lastMaintenance: "2026-10-10",
    nextScheduled: "2026-12-15",
    operatingHours: 2950,
    currentCycle: 120,
    topFactors: [
      { name: "Main ram manifold pressure stable", value: 18, category: "Pressure", status: "normal" },
      { name: "Hydraulic oil fluid viscosity in nominal band", value: 22, category: "Fluids", status: "normal" }
    ],
    breakdownSensors: [
      { name: "Hydraulic Pressure", value: 20, color: "#38BDF8" },
      { name: "Thermal State", value: 15, color: "#FF5B64" },
      { name: "Pump Motor Current", value: 25, color: "#F5B942" },
      { name: "Fluid Viscosity", value: 22, color: "#43D17D" }
    ],
    predictedFault: "Nominal operation — regular filter change in 45 days",
    dataSource: "Real-time Edge Gateway Replay",
    dataQuality: "Optimal (Zero sensor anomalies)",
    qualityFlags: []
  },
  {
    id: "MC-9104",
    name: "CNC Milling Station 5-Axis",
    type: "CNC Machining Center",
    line: "Precision Tooling 4",
    status: "Operational",
    criticality: "Medium",
    criticalityScore: 65,
    healthScore: 61,
    riskScore: 39,
    riskLevel: "Medium",
    productionImpact: 60,
    urgency: 45,
    predictedRul: 72,
    rulUnit: "cycles",
    lastMaintenance: "2026-09-28",
    nextScheduled: "2026-11-20",
    operatingHours: 5120,
    currentCycle: 189,
    topFactors: [
      { name: "Spindle bearing thermal accumulation (68°C)", value: 52, category: "Thermal", status: "warning" },
      { name: "Tool chatter vibration in Y-axis", value: 41, category: "Vibration", status: "normal" }
    ],
    breakdownSensors: [
      { name: "Spindle Thermal", value: 55, color: "#FF5B64" },
      { name: "Drive Current", value: 48, color: "#F5B942" },
      { name: "Y-Axis Chatter", value: 41, color: "#38BDF8" },
      { name: "Coolant Flow Rate", value: 35, color: "#43D17D" }
    ],
    predictedFault: "Spindle bearing lubricant breakdown warning",
    dataSource: "CNC Fanuc Protocol Gateway",
    dataQuality: "Good (Active stream)",
    qualityFlags: []
  },
  {
    id: "MC-3319",
    name: "Rotary Screw Compressor C-3",
    type: "Air Compressor",
    line: "Utilities Facility",
    status: "Operational",
    criticality: "Low",
    criticalityScore: 40,
    healthScore: 89,
    riskScore: 11,
    riskLevel: "Healthy",
    productionImpact: 35,
    urgency: 15,
    predictedRul: 240,
    rulUnit: "cycles",
    lastMaintenance: "2026-10-01",
    nextScheduled: "2027-01-10",
    operatingHours: 8400,
    currentCycle: 95,
    topFactors: [
      { name: "Discharge air pressure 7.8 bar nominal", value: 12, category: "Pressure", status: "normal" },
      { name: "Separator differential pressure optimal", value: 10, category: "Fluids", status: "normal" }
    ],
    breakdownSensors: [
      { name: "Discharge Pressure", value: 15, color: "#38BDF8" },
      { name: "Intercooler Temp", value: 8, color: "#FF5B64" },
      { name: "Motor Load", value: 14, color: "#F5B942" },
      { name: "Separator Differential", value: 12, color: "#43D17D" }
    ],
    predictedFault: "No actionable faults detected",
    dataSource: "Modbus RTU Simulator",
    dataQuality: "Optimal",
    qualityFlags: []
  },
  {
    id: "MC-6122",
    name: "Centrifugal Slurry Pump P-12",
    type: "Centrifugal Pump",
    line: "Chemical Treatment Bay",
    status: "Operational",
    criticality: "High",
    criticalityScore: 85,
    healthScore: 35,
    riskScore: 65,
    riskLevel: "Warning",
    productionImpact: 80,
    urgency: 70,
    predictedRul: 29,
    rulUnit: "cycles",
    lastMaintenance: "2026-07-19",
    nextScheduled: "2026-11-01",
    operatingHours: 9200,
    currentCycle: 290,
    topFactors: [
      { name: "Cavitation acoustic frequency peak (12kHz)", value: 72, category: "Acoustics", status: "critical" },
      { name: "Suction head pressure oscillation", value: 65, category: "Pressure", status: "warning" },
      { name: "Mechanical seal fluid leakage indicator", value: 58, category: "Seal", status: "warning" }
    ],
    breakdownSensors: [
      { name: "Cavitation Acoustics", value: 72, color: "#FF5B64" },
      { name: "Suction Pressure", value: 65, color: "#F5B942" },
      { name: "Seal Flush Fluid", value: 58, color: "#38BDF8" },
      { name: "Bearing Housing Temp", value: 45, color: "#43D17D" }
    ],
    predictedFault: "Impeller vane cavitation erosion & seal degradation",
    dataSource: "HART Protocol Replay",
    dataQuality: "Good (Valid timestamps)",
    qualityFlags: []
  },
  {
    id: "MC-5099",
    name: "Overhead Gantry Crane G-1",
    type: "Lifting System",
    line: "Logistics Yard",
    status: "Under Maintenance",
    criticality: "Medium",
    criticalityScore: 60,
    healthScore: 15,
    riskScore: 85,
    riskLevel: "Critical",
    productionImpact: 65,
    urgency: 85,
    predictedRul: 6,
    rulUnit: "cycles",
    lastMaintenance: "2026-10-24",
    nextScheduled: "2026-10-28",
    operatingHours: 11200,
    currentCycle: 410,
    topFactors: [
      { name: "Hoist brake shoe wear limit reached (95%)", value: 92, category: "Brake", status: "critical" },
      { name: "Cable spool motor winding temperature", value: 78, category: "Thermal", status: "critical" }
    ],
    breakdownSensors: [
      { name: "Brake Pad Friction", value: 92, color: "#FF5B64" },
      { name: "Spool Motor Temp", value: 78, color: "#F5B942" },
      { name: "Gearbox Vibration", value: 40, color: "#43D17D" },
      { name: "Wire Rope Tension", value: 30, color: "#38BDF8" }
    ],
    predictedFault: "Hoist mechanical brake overhaul in progress",
    dataSource: "Crane Telematics Replay",
    dataQuality: "Stale (Unit currently halted for service)",
    qualityFlags: ["Telemetry suspended during active service"]
  },
  {
    id: "MC-1044",
    name: "Induction Heat Treatment Furnace",
    type: "Thermal Furnace",
    line: "Heat Treat Cell 3",
    status: "Operational",
    criticality: "Critical",
    criticalityScore: 92,
    healthScore: 78,
    riskScore: 22,
    riskLevel: "Healthy",
    productionImpact: 90,
    urgency: 30,
    predictedRul: 145,
    rulUnit: "cycles",
    lastMaintenance: "2026-09-05",
    nextScheduled: "2026-12-01",
    operatingHours: 7310,
    currentCycle: 156,
    topFactors: [
      { name: "Coil temperature gradient uniform", value: 24, category: "Thermal", status: "normal" },
      { name: "Flux transformer efficiency 96.2%", value: 18, category: "Electrical", status: "normal" }
    ],
    breakdownSensors: [
      { name: "Induction Coil Temp", value: 25, color: "#38BDF8" },
      { name: "Flux Core Gradient", value: 22, color: "#FF5B64" },
      { name: "Transformer Current", value: 28, color: "#F5B942" },
      { name: "Chiller Loop Temp", value: 24, color: "#43D17D" }
    ],
    predictedFault: "Operating within normal safety margins",
    dataSource: "OPC-UA Telemetry Stream",
    dataQuality: "Optimal (Zero packet drops)",
    qualityFlags: []
  }
];

/**
 * Generate realistic deterministic historical sensor readings for a machine.
 * Features NASA C-MAPSS parameters:
 * s2_t24 (Total Temp LPC), s4_t50 (Total Temp LPT), s7_p30 (Pressure HPC),
 * s8_nf (Physical Fan Speed), s9_nc (Core Speed), s11_ps30 (Static Pressure HPC),
 * and overall vibration amplitude (mm/s).
 */
export function generateSensorHistory(machineId, count = 35) {
  const machine = initialMachines.find(m => m.id === machineId) || initialMachines[0];
  const isHighRisk = machine.riskScore > 50;
  const baseCycle = machine.currentCycle - count;

  return Array.from({ length: count }, (_, i) => {
    const cycle = baseCycle + i + 1;
    const progress = i / count; // 0 to 1
    
    // Simulate degradation trends
    const noise = Math.sin(i * 1.3) * 0.8 + Math.cos(i * 0.7) * 0.5;
    const tempDegradation = isHighRisk ? progress * 24.5 : progress * 3.2;
    const vibDegradation = isHighRisk ? progress * 5.2 : progress * 0.7;
    const pressureDrop = isHighRisk ? progress * 14.0 : progress * 2.0;

    const t24 = +(642 + tempDegradation + noise * 1.5).toFixed(1); // LPC Temp °C
    const t50 = +(1408 + (isHighRisk ? progress * 32.0 : progress * 4.0) + noise * 2.2).toFixed(1); // LPT Temp °C
    const p30 = +(553.8 - pressureDrop + (noise * 1.2)).toFixed(1); // HPC Pressure kPa
    const nf = +(2388 - (isHighRisk ? progress * 85 : progress * 10) + noise * 3).toFixed(0); // Fan Speed RPM
    const nc = +(9064 - (isHighRisk ? progress * 120 : progress * 15) + noise * 5).toFixed(0); // Core Speed RPM
    const ps30 = +(47.2 - (isHighRisk ? progress * 2.8 : progress * 0.3) + noise * 0.2).toFixed(2); // Static Pressure psia
    const vib = +(2.4 + vibDegradation + (noise * 0.2)).toFixed(2); // Vibration mm/s

    return {
      cycle,
      timestamp: `Cycle ${cycle}`,
      // NASA C-MAPSS channels
      s2_t24: t24,
      s4_t50: t50,
      s7_p30: p30,
      s8_nf: nf,
      s9_nc: nc,
      s11_ps30: ps30,
      vibration: vib,
      // Backward-compatible aliases for charts
      temperature: t24,
      pressure: p30,
      rpm: nf,
      current: +(42.5 + (isHighRisk ? progress * 14 : progress * 2) + noise * 0.6).toFixed(1),
      oilHealth: +(Math.max(10, 98 - (isHighRisk ? progress * 55 : progress * 12) + noise)).toFixed(1),
    };
  });
}
