import mongoose from 'mongoose';

const machineSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: [true, 'Machine ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Machine name is required'],
      trim: true
    },
    machineType: {
      type: String,
      required: [true, 'Machine type is required'],
      enum: {
        values: [
          'CNC_MILL',
          'HYDRAULIC_PRESS',
          'TURBINE',
          'ROBOTIC_ARM',
          'CENTRIFUGAL_PUMP',
          'COMPRESSOR',
          'CONVEYOR',
          'OTHER'
        ],
        message: '{VALUE} is not a supported machine type'
      },
      default: 'CNC_MILL'
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['operational', 'degraded', 'critical', 'maintenance', 'offline'],
        message: '{VALUE} is not a valid status'
      },
      default: 'operational',
      index: true
    },
    criticality: {
      type: String,
      required: true,
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: '{VALUE} is not a valid criticality level'
      },
      default: 'medium',
      index: true
    },
    downtimeCostPerHour: {
      type: Number,
      required: [true, 'Downtime cost per hour is required'],
      min: [0, 'Downtime cost cannot be negative'],
      default: 1000
    },
    operatingParameters: {
      airTempKelvin: { type: Number, default: 300.0 },
      processTempKelvin: { type: Number, default: 310.0 },
      rotationalSpeedRpm: { type: Number, default: 1500 },
      torqueNm: { type: Number, default: 40.0 },
      toolWearMinutes: { type: Number, default: 0 },
      vibrationMmS: { type: Number, default: 2.5 }
    },
    lastMaintenanceDate: {
      type: Date,
      default: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    },
    nextScheduledMaintenance: {
      type: Date
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for days since last maintenance
machineSchema.virtual('daysSinceLastMaintenance').get(function () {
  if (!this.lastMaintenanceDate) return 0;
  const diffTime = Math.abs(Date.now() - new Date(this.lastMaintenanceDate).getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

export const Machine = mongoose.model('Machine', machineSchema);
