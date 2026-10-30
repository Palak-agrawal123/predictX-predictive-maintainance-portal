import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema(
  {
    predictionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    machineId: {
      type: String,
      required: [true, 'Machine ID is required for prediction record'],
      trim: true,
      uppercase: true,
      index: true
    },
    predictionType: {
      type: String,
      required: true,
      enum: ['failure_risk_classification', 'rul_regression'],
      default: 'failure_risk_classification'
    },
    predictionResult: {
      riskProbability: {
        type: Number,
        required: true,
        min: 0,
        max: 1
      },
      riskLevel: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high', 'critical']
      },
      healthScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
      },
      estimatedRULDays: {
        type: Number,
        default: null
      },
      suspectedFailureMode: {
        type: String,
        default: 'None'
      },
      recommendedAction: {
        type: String,
        default: 'Routine monitoring'
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.90
      }
    },
    modelVersion: {
      type: String,
      required: true,
      default: 'xgb-industrial-v1.0'
    },
    isMock: {
      type: Boolean,
      required: true,
      default: false
    },
    executionSource: {
      type: String,
      required: true,
      enum: ['ml_service_fastapi', 'heuristic_mock_adapter']
    },
    inputFeatures: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    predictionTimestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    // Human-in-the-Loop (HITL) Review & Priority Override Fields
    predictedRisk: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      uppercase: true,
      index: true
    },
    maintenancePriority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      uppercase: true,
      index: true
    },
    reviewStatus: {
      type: String,
      enum: ['PENDING', 'REVIEWED'],
      default: 'PENDING',
      uppercase: true,
      index: true
    },
    isOverridden: {
      type: Boolean,
      default: false,
      index: true
    },
    reviewedBy: {
      type: String,
      default: null,
      trim: true
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewReason: {
      type: String,
      default: '',
      trim: true
    },
    reviewHistory: [
      {
        action: {
          type: String,
          enum: ['CONFIRMED', 'OVERRIDDEN'],
          uppercase: true,
          required: true
        },
        previousPriority: {
          type: String,
          uppercase: true
        },
        newPriority: {
          type: String,
          uppercase: true
        },
        reason: {
          type: String,
          default: ''
        },
        reviewedBy: {
          type: String,
          default: 'Maintenance Reviewer'
        },
        reviewedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Pre-save hook: ensure predictedRisk and maintenancePriority are initialized
predictionSchema.pre('save', function (next) {
  if (!this.predictedRisk && this.predictionResult?.riskLevel) {
    const r = this.predictionResult.riskLevel.toUpperCase();
    this.predictedRisk = r === 'CRITICAL' ? 'HIGH' : r;
  }
  if (!this.maintenancePriority && this.predictedRisk) {
    this.maintenancePriority = this.predictedRisk;
  }
  next();
});

// Compound index for querying recent predictions for a machine
predictionSchema.index({ machineId: 1, predictionTimestamp: -1 });
predictionSchema.index({ reviewStatus: 1, predictionTimestamp: -1 });

export const Prediction = mongoose.model('Prediction', predictionSchema);

