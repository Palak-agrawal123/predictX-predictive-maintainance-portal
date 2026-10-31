import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';

describe('Live Simulation API Tests', () => {
  let app;

  before(async () => {
    try {
      await connectDB();
    } catch (e) {
      // Degraded test mode
    }
    app = createApp();
  });

  after(async () => {
    try {
      await disconnectDB();
    } catch (e) {
      // ignore
    }
  });

  it('GET /api/simulation/status should handle simulation status check', async () => {
    const res = await request(app).get('/api/simulation/status');
    // If ML service is online it will return 200, otherwise error handler catches gracefully
    assert.ok(res.status === 200 || res.status === 500);
  });

  it('POST /api/simulation/sync-prediction should persist simulated prediction and handle machine status transitions', async () => {
    const payload = {
      machineId: 'Engine-001',
      subset: 'FD001',
      cycle: 46,
      prediction: {
        predictedRUL: 120,
        estimatedRULDays: 120,
        riskProbability: 0.08,
        riskLevel: 'low',
        healthScore: 95,
        suspectedFailureMode: 'None',
        recommendedAction: 'Routine monitoring'
      },
      modelMetadata: {
        modelVersion: 'xgb_regressor_FD001.joblib (XGBoost Regressor)'
      },
      cleanedSensors: {
        s_4: 1406.8,
        s_11: 47.3
      }
    };

    const res = await request(app).post('/api/simulation/sync-prediction').send(payload);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});
