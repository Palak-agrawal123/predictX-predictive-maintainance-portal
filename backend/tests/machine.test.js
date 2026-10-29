import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Machine } from '../src/models/Machine.js';

describe('Machine API Tests', () => {
  let app;
  const testMachineId = 'MCH-TEST-999';

  before(async () => {
    await connectDB();
    app = createApp();
  });

  after(async () => {
    await Machine.deleteOne({ machineId: testMachineId });
    await disconnectDB();
  });

  it('GET /api/machines should return an array of machines', async () => {
    const res = await request(app).get('/api/machines');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
  });

  it('GET /api/machines/:id should return single machine details', async () => {
    const res = await request(app).get('/api/machines/MCH-CNC-101');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.machineId, 'MCH-CNC-101');
  });

  it('GET /api/machines/:id should return 404 for non-existent machine', async () => {
    const res = await request(app).get('/api/machines/MCH-UNKNOWN-404');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.message.includes('not found'));
  });

  it('POST /api/machines should register a new machine', async () => {
    const newMachine = {
      machineId: testMachineId,
      name: 'Test Induction Motor Unit',
      machineType: 'OTHER',
      location: 'Test Testing Rig 4',
      status: 'operational',
      criticality: 'medium',
      downtimeCostPerHour: 1200
    };

    const res = await request(app).post('/api/machines').send(newMachine);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.machineId, testMachineId);
  });

  it('POST /api/machines should reject duplicate machine registration with 409', async () => {
    const duplicateMachine = {
      machineId: testMachineId,
      name: 'Duplicate Machine',
      machineType: 'OTHER',
      location: 'Sector X',
      downtimeCostPerHour: 1000
    };

    const res = await request(app).post('/api/machines').send(duplicateMachine);
    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  it('POST /api/machines should reject invalid payload with 400', async () => {
    const invalidMachine = {
      machineId: 'X', // too short
      name: '',
      downtimeCostPerHour: -500 // negative
    };

    const res = await request(app).post('/api/machines').send(invalidMachine);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(Array.isArray(res.body.error.details));
  });

  it('GET /api/machines/:id/sensors should return telemetry series', async () => {
    const res = await request(app).get('/api/machines/MCH-CNC-101/sensors?limit=10');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });
});
