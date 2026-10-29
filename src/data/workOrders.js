/**
 * Mock dataset for Work Orders.
 * Connects machine IDs with status workflows: Draft, Approved, In Progress, Completed, Cancelled.
 */
export const initialWorkOrders = [
  {
    id: "WO-9041",
    machineId: "MC-8210",
    machineName: "Robotic Welder K-400",
    priority: "Urgent", // Low, Medium, High, Urgent
    priorityScore: 89,
    status: "In Progress", // Draft, Approved, In Progress, Completed, Cancelled
    suspectedIssue: "Axis 3 Harmonic Reducer Bearing Imminent Failure",
    suggestedInspection: "Disassemble axis 3 casing, inspect gear teeth backlash and measure axial play with dial indicator.",
    technician: "Alex Rivera (Lead Mechatronics)",
    scheduledDate: "2026-10-28",
    createdAt: "2026-10-25",
    estimatedHours: 4.5,
    resolutionNotes: "Parts kit HK-88 staged at cell B. Lockout-tagout scheduled at 14:00.",
    source: "Automated ML Risk Trigger"
  },
  {
    id: "WO-9038",
    machineId: "MC-7801",
    machineName: "Turbofan Engine Unit #01 (C-MAPSS)",
    priority: "High",
    priorityScore: 78,
    status: "Approved",
    suspectedIssue: "High-pressure turbine seal degradation & blade thermal distress",
    suggestedInspection: "Borescope inspection of HP turbine stage 2 blades and clearance check on ceramic seal ring.",
    technician: "Sarah Chen (Turbomachinery Specialist)",
    scheduledDate: "2026-11-02",
    createdAt: "2026-10-26",
    estimatedHours: 6.0,
    resolutionNotes: "Pending planned downtime slot in shift 3.",
    source: "PredictX Explainability Engine"
  },
  {
    id: "WO-9022",
    machineId: "MC-6122",
    machineName: "Centrifugal Slurry Pump P-12",
    priority: "High",
    priorityScore: 72,
    status: "Draft",
    suspectedIssue: "Impeller cavitation and mechanical seal leakage",
    suggestedInspection: "Ultrasonic cavitation survey, check suction strainer for blockages and examine gland packing.",
    technician: "Marcus Vance",
    scheduledDate: "2026-11-04",
    createdAt: "2026-10-27",
    estimatedHours: 3.0,
    resolutionNotes: "Drafted by plant engineer awaiting supervisory signoff.",
    source: "Acoustic Telemetry Anomaly"
  },
  {
    id: "WO-8991",
    machineId: "MC-5099",
    machineName: "Overhead Gantry Crane G-1",
    priority: "Urgent",
    priorityScore: 92,
    status: "In Progress",
    suspectedIssue: "Hoist mechanical brake shoe wear beyond safe operational threshold",
    suggestedInspection: "Replace main friction pads, adjust electro-magnetic release air gap, conduct static proof load test.",
    technician: "Devon Brooks",
    scheduledDate: "2026-10-26",
    createdAt: "2026-10-24",
    estimatedHours: 8.0,
    resolutionNotes: "Emergency brake pad kit delivered. Hoist assembly isolated with mechanical lockpins.",
    source: "Manual Safety Interlock Alert"
  },
  {
    id: "WO-8910",
    machineId: "MC-9104",
    machineName: "CNC Milling Station 5-Axis",
    priority: "Medium",
    priorityScore: 52,
    status: "Completed",
    suspectedIssue: "Spindle bearing lubricant breakdown warning",
    suggestedInspection: "Purge spindle oil lines, flush reservoir, refill with ISO VG 32 synthetic spindle fluid.",
    technician: "Elena Rostova",
    scheduledDate: "2026-10-18",
    createdAt: "2026-10-15",
    estimatedHours: 2.5,
    resolutionNotes: "Completed on 2026-10-18. Lubricant flushed, vibration dropped from 3.8 mm/s to 1.1 mm/s. Machine cleared for production.",
    source: "Scheduled PM Cycle"
  },
  {
    id: "WO-8854",
    machineId: "MC-4402",
    machineName: "Hydraulic Stamping Press 500T",
    priority: "Low",
    priorityScore: 28,
    status: "Completed",
    suspectedIssue: "Routine filter cartridge replacement and oil sampling",
    suggestedInspection: "Inspect 10-micron return filter, draw fluid sample for particle count spectrometry.",
    technician: "Alex Rivera",
    scheduledDate: "2026-10-10",
    createdAt: "2026-10-08",
    estimatedHours: 1.5,
    resolutionNotes: "Filter replaced with genuine Hydac 0330D010ON. Lab sample sent; zero contamination reported.",
    source: "Routine Schedule"
  }
];
