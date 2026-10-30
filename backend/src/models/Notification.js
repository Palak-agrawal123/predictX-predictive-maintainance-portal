import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      default: 'plant_operator_px',
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'MACHINE_RISK_HIGH',
        'MACHINE_RISK_CRITICAL',
        'MACHINE_RUL_WARNING',
        'MACHINE_RUL_CRITICAL',
        'SENSOR_ANOMALY',
        'WORK_ORDER_CREATED',
        'WORK_ORDER_ASSIGNED',
        'WORK_ORDER_IN_PROGRESS',
        'WORK_ORDER_COMPLETED',
        'WORK_ORDER_CANCELLED',
        'WORK_ORDER_PRIORITY_CHANGED',
        'REVIEW_REQUESTED',
        'REVIEW_APPROVED',
        'REVIEW_OVERRIDDEN',
        'MACHINE_REGISTERED',
        'MACHINE_STATUS_CHANGED',
        'SYSTEM_ERROR'
      ],
      index: true
    },
    category: {
      type: String,
      required: true,
      enum: [
        'MACHINE_HEALTH',
        'MAINTENANCE',
        'WORK_ORDER',
        'HUMAN_REVIEW',
        'ML_PREDICTION',
        'SYSTEM'
      ],
      index: true
    },
    severity: {
      type: String,
      required: true,
      enum: ['INFO', 'WARNING', 'CRITICAL', 'SUCCESS'],
      default: 'INFO',
      index: true
    },
    machineId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: null
    },
    workOrderId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: null
    },
    relatedEntityType: {
      type: String,
      enum: ['Machine', 'WorkOrder', 'Prediction', 'ReviewAudit', 'System'],
      default: null
    },
    relatedEntityId: {
      type: String,
      default: null
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    },
    actionUrl: {
      type: String,
      default: null
    },
    dedupKey: {
      type: String,
      trim: true,
      index: true,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for relative time string calculation
notificationSchema.virtual('timeAgo').get(function () {
  const diffSec = Math.floor((Date.now() - new Date(this.createdAt).getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
});

// Compound indexes for performant querying and filtering
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ dedupKey: 1, createdAt: -1 });
notificationSchema.index({ machineId: 1, eventType: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
