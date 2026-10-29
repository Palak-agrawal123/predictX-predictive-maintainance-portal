import mongoose from 'mongoose';

const modelEvaluationSchema = new mongoose.Schema(
  {
    modelName: {
      type: String,
      required: true,
      trim: true
    },
    modelVersion: {
      type: String,
      required: true,
      trim: true
    },
    dataset: {
      type: String,
      required: true,
      trim: true
    },
    taskType: {
      type: String,
      required: true,
      enum: ['binary_classification', 'multiclass_classification', 'regression'],
      default: 'binary_classification'
    },
    metrics: {
      accuracy: { type: Number, required: true },
      precision: { type: Number, required: true },
      recall: { type: Number, required: true },
      f1Score: { type: Number, required: true },
      rocAuc: { type: Number, required: true }
    },
    sampleCount: {
      type: Number,
      required: true
    },
    failureModesEvaluated: [
      {
        type: String
      }
    ],
    featureImportance: [
      {
        feature: { type: String, required: true },
        importance: { type: Number, required: true }
      }
    ],
    evaluatedAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

export const ModelEvaluation = mongoose.model('ModelEvaluation', modelEvaluationSchema);
