import mongoose from 'mongoose';

const sensorLogSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    airTemperature: {
      type: Number,
      required: true // Kelvin
    },
    processTemperature: {
      type: Number,
      required: true // Kelvin
    },
    rotationalSpeed: {
      type: Number,
      required: true // RPM
    },
    torque: {
      type: Number,
      required: true // Nm
    },
    toolWear: {
      type: Number,
      required: true // Minutes
    },
    vibration: {
      type: Number,
      default: 2.0 // mm/s
    },
    pressureBar: {
      type: Number,
      default: 3.5 // Bar
    }
  },
  {
    timestamps: false
  }
);

// Compound index for time-series range lookups per machine
sensorLogSchema.index({ machineId: 1, timestamp: -1 });

export const SensorLog = mongoose.model('SensorLog', sensorLogSchema);
