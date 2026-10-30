import mongoose from 'mongoose';

const reviewAuditSchema = new mongoose.Schema(
  {
    predictionId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    machineId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    previousPriority: {
      type: String,
      required: true,
      uppercase: true
    },
    newPriority: {
      type: String,
      required: true,
      uppercase: true
    },
    action: {
      type: String,
      required: true,
      enum: ['CONFIRMED', 'OVERRIDDEN'],
      uppercase: true,
      index: true
    },
    reason: {
      type: String,
      default: '',
      trim: true
    },
    reviewedBy: {
      type: String,
      required: true,
      default: 'Maintenance Engineer',
      trim: true
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

reviewAuditSchema.index({ predictionId: 1, reviewedAt: -1 });
reviewAuditSchema.index({ machineId: 1, reviewedAt: -1 });

export const ReviewAudit = mongoose.model('ReviewAudit', reviewAuditSchema);
