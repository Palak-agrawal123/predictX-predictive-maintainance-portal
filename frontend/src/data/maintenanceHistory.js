/**
 * Historical maintenance records for past work and completed maintenance.
 */
export const initialMaintenanceHistory = [
  {
    id: "HIST-501",
    workOrderId: "WO-8910",
    machineId: "MC-9104",
    machineName: "CNC Milling Station 5-Axis",
    activityType: "Corrective Lubricant Flush",
    technician: "Elena Rostova",
    completedDate: "2026-10-18",
    status: "Completed",
    downtimeHours: 2.5,
    costEstimate: "$340",
    resolutionNotes: "Purged spindle lubrication circuit. Replaced inline fine filter. Spindle temperature normalized to 42°C under full load.",
    partsReplaced: ["Spindle Filter #SF-12", "Mobil Velocite No. 3 (5L)"]
  },
  {
    id: "HIST-502",
    workOrderId: "WO-8854",
    machineId: "MC-4402",
    machineName: "Hydraulic Stamping Press 500T",
    activityType: "Preventive Filter Change",
    technician: "Alex Rivera",
    completedDate: "2026-10-10",
    status: "Completed",
    downtimeHours: 1.5,
    costEstimate: "$180",
    resolutionNotes: "Replaced return line hydraulic filter cartridge. Inspected reservoir breathers and top seal.",
    partsReplaced: ["Hydac Return Filter 0330D010ON"]
  },
  {
    id: "HIST-503",
    workOrderId: "WO-8720",
    machineId: "MC-7801",
    machineName: "PC-Dhriti Turbofan Alpha",
    activityType: "Routine Borescope Inspection",
    technician: "Sarah Chen",
    completedDate: "2026-09-14",
    status: "Completed",
    downtimeHours: 4.0,
    costEstimate: "$750",
    resolutionNotes: "Borescope inspection of LP & HP stages. Minor thermal discolouration noted on stage 2 blades; within OEM flight tolerances.",
    partsReplaced: ["Access Port Gaskets #AG-4"]
  },
  {
    id: "HIST-504",
    workOrderId: "WO-8650",
    machineId: "MC-3319",
    machineName: "Rotary Screw Compressor C-3",
    activityType: "Air/Oil Separator Replacement",
    technician: "Devon Brooks",
    completedDate: "2026-10-01",
    status: "Completed",
    downtimeHours: 3.0,
    costEstimate: "$520",
    resolutionNotes: "Installed new coalescing separator element. Cleaned scavenge line orifice and verified differential pressure < 0.2 bar.",
    partsReplaced: ["Separator Element #OS-88", "Scavenge Check Valve"]
  },
  {
    id: "HIST-505",
    workOrderId: "WO-8411",
    machineId: "MC-8210",
    machineName: "Robotic Welder K-400",
    activityType: "Joint Cable Harness Overhaul",
    technician: "Alex Rivera",
    completedDate: "2026-08-02",
    status: "Completed",
    downtimeHours: 5.0,
    costEstimate: "$1,120",
    resolutionNotes: "Replaced fatigued dress pack cable on Axis 2-3 pivot. Calibrated zero-offset home positions.",
    partsReplaced: ["Murrplastik Robotic Dresspack #RP-90"]
  }
];
