import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { WorkOrder } from '../src/models/WorkOrder.js';

describe('Work Order API Tests', () => {
  let app;
  let createdWorkOrderId;

  before(async () => {
    await connectDB();
    app = createApp();
  });

  after(async () => {
    if (createdWorkOrderId) {
      await WorkOrder.deleteOne({ workOrderId: createdWorkOrderId });
    }
    await disconnectDB();
  });

  it('POST /api/work-orders should create draft work order for valid machine', async () => {
    const payload = {
      machineId: 'MCH-CNC-101',
      title: 'Spindle Bearing Lubrication Test',
      description: 'Scheduled preventative greasing of ceramic spindle bearings.',
      priority: 'high',
      assignedTo: 'Rajesh Sharma'
    };

    const res = await request(app).post('/api/work-orders').send(payload);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.workOrderId);
    assert.equal(res.body.data.machineId, 'MCH-CNC-101');
    assert.equal(res.body.data.status, 'draft');

    createdWorkOrderId = res.body.data.workOrderId;
  });

  it('POST /api/work-orders should return 404 if machine does not exist', async () => {
    const payload = {
      machineId: 'MCH-INVALID-999',
      title: 'Test Order',
      description: 'Test Description'
    };

    const res = await request(app).post('/api/work-orders').send(payload);
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  it('POST /api/work-orders should reject missing required fields with 400', async () => {
    const payload = {
      machineId: 'MCH-CNC-101'
      // missing title and description
    };

    const res = await request(app).post('/api/work-orders').send(payload);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it('GET /api/work-orders should return all work orders', async () => {
    const res = await request(app).get('/api/work-orders');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('GET /api/work-orders/:id should return single work order details', async () => {
    const res = await request(app).get(`/api/work-orders/${createdWorkOrderId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.workOrderId, createdWorkOrderId);
    assert.ok(res.body.data.machineDetails);
  });

  it('PATCH /api/work-orders/:id/status should allow valid transition draft -> approved', async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${createdWorkOrderId}/status`)
      .send({ status: 'approved' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'approved');
  });

  it('PATCH /api/work-orders/:id/status should reject invalid transition approved -> completed directly with 400', async () => {
    const res = await request(app)
      .patch(`/api/work-orders/${createdWorkOrderId}/status`)
      .send({ status: 'completed' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.message.includes('Invalid state transition'));
  });
});
