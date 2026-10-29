import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';

describe('Priority & Dashboard API Tests', () => {
  let app;

  before(async () => {
    await connectDB();
    app = createApp();
  });

  after(async () => {
    await disconnectDB();
  });

  it('GET /api/machine-priorities should return ranked list of machines with formula metadata and reasons', async () => {
    const res = await request(app).get('/api/machine-priorities');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);

    // Verify formula metadata is returned
    assert.ok(res.body.formula);
    assert.ok(res.body.formula.weights);
    assert.ok(res.body.formula.notes);

    // Verify first machine has priorityScore and reasons
    const topMachine = res.body.data[0];
    assert.ok(topMachine.machineId);
    assert.ok(topMachine.priorityEvaluation);
    assert.ok(typeof topMachine.priorityEvaluation.priorityScore === 'number');
    assert.ok(Array.isArray(topMachine.priorityEvaluation.reasons));
    assert.ok(topMachine.priorityEvaluation.disclaimer);

    // Verify rawModelRisk is strictly separated from priorityScore
    assert.ok(topMachine.rawModelRisk);
    assert.ok(typeof topMachine.rawModelRisk.riskProbability === 'number');

    // Verify descending order of priority score
    for (let i = 0; i < res.body.data.length - 1; i++) {
      assert.ok(
        res.body.data[i].priorityEvaluation.priorityScore >=
          res.body.data[i + 1].priorityEvaluation.priorityScore,
        'Machines must be sorted descending by priorityScore'
      );
    }
  });

  it('GET /api/dashboard/summary should return consolidated fleet overview', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.fleetOverview);
    assert.ok(res.body.data.workOrders);
    assert.ok(res.body.data.mlEngine);
  });

  it('GET /api/model-metrics should return model evaluation records', async () => {
    const res = await request(app).get('/api/model-metrics');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.data[0].metrics);
    assert.ok(typeof res.body.data[0].metrics.accuracy === 'number');
  });
});
