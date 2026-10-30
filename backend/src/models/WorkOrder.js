import mongoose from 'mongoose';

const workOrderSchema = new mongoose.Schema(
  {
    workOrderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    machineId: {
      type: String,
      required: [true, 'Machine ID is required for work order'],
      trim: true,
      uppercase: true,
      index: true
    },
    predictionId: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Work order title is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Work order description is required'],
      trim: true
    },
    priority: {
      type: String,
      required: true,
      enum: {
        values: ['low', 'medium', 'high', 'urgent'],
        message: '{VALUE} is not a valid priority level'
      },
      default: 'medium',
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['draft', 'approved', 'in_progress', 'completed', 'cancelled'],
        message: '{VALUE} is not a valid work order status'
      },
      default: 'draft',
      index: true
    },
    assignedTo: {
      type: String,
      default: 'Unassigned',
      trim: true
    },
    scheduledDate: {
      type: Date,
      default: () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    },
    completedAt: {
      type: Date,
      default: null
    },
    resolutionNotes: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for machine + status queries
workOrderSchema.index({ machineId: 1, status: 1 });

export const WorkOrder = mongoose.model('WorkOrder', workOrderSchema);
