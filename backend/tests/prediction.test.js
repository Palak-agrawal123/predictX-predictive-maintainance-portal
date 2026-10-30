import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';

describe('Prediction API Tests', () => {
  let app;

  before(async () => {
    await connectDB();
    app = createApp();
  });

  after(async () => {
    await disconnectDB();
  });

  it('POST /api/predict should reject payload without machineId with 400', async () => {
    const res = await request(app).post('/api/predict').send({
      sensors: { airTemperature: 300 }
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it('POST /api/predict should reject payload without numeric sensors with 400', async () => {
    const res = await request(app).post('/api/predict').send({
      machineId: 'MCH-CNC-101',
      sensors: 'invalid-sensors-string'
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it('POST /api/predict should return 404 for non-existent machineId', async () => {
    const res = await request(app).post('/api/predict').send({
      machineId: 'MCH-NONEXISTENT-999',
      sensors: { airTemperature: 300, processTemperature: 310 }
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.message.includes('does not exist'));
  });

  it('POST /api/predict should successfully process prediction and transparently tag mock status if ML service offline', async () => {
    const payload = {
      machineId: 'MCH-CNC-101',
      sensors: {
        airTemperature: 298.5,
        processTemperature: 308.7,
        rotationalSpeed: 1550,
        torque: 42.8,
        toolWear: 45
      }
    };

    const res = await request(app).post('/api/predict').send(payload);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.predictionId);
    assert.equal(res.body.data.machineId, 'MCH-CNC-101');
    assert.ok(typeof res.body.data.predictionResult.riskProbability === 'number');
    assert.ok(res.body.data.predictionResult.riskLevel);
    assert.ok(typeof res.body.data.isMock === 'boolean');
    assert.ok(['ml_service_fastapi', 'heuristic_mock_adapter'].includes(res.body.data.executionSource));
  });

  it('GET /api/predictions should return list of historical predictions', async () => {
    const res = await request(app).get('/api/predictions?limit=10');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
  });
});
