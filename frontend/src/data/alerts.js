/**
 * Real-time alert notifications for the industrial portal.
 */
export const initialAlerts = [
  {
    id: "ALT-1",
    machineId: "MC-8210",
    machineName: "Robotic Welder K-400",
    severity: "Critical",
    message: "Axis 3 Servo current surge (+34%) exceeding safety envelope",
    timestamp: "12m ago",
    read: false
  },
  {
    id: "ALT-2",
    machineId: "MC-5099",
    machineName: "Overhead Gantry Crane G-1",
    severity: "Critical",
    message: "Hoist mechanical brake shoe wear sensor triggered limit",
    timestamp: "45m ago",
    read: false
  },
  {
    id: "ALT-3",
    machineId: "MC-7801",
    machineName: "Turbofan Engine Unit #01 (C-MAPSS)",
    severity: "Warning",
    message: "High-pressure turbine seal degradation & static pressure drift detected",
    timestamp: "2h ago",
    read: false
  },
  {
    id: "ALT-4",
    machineId: "MC-6122",
    machineName: "Centrifugal Slurry Pump P-12",
    severity: "Warning",
    message: "12kHz cavitation acoustic harmonics detected in slurry feed",
    timestamp: "4h ago",
    read: true
  }
];
