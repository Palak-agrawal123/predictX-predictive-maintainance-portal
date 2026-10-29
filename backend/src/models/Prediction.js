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
    }
  },
  {
    timestamps: true
  }
);

// Compound index for querying recent predictions for a machine
predictionSchema.index({ machineId: 1, predictionTimestamp: -1 });

export const Prediction = mongoose.model('Prediction', predictionSchema);
