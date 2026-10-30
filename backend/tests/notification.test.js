import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Notification } from '../src/models/Notification.js';
import { Machine } from '../src/models/Machine.js';

describe('Notification System API & Event Integration Tests', () => {
  let app;
  let testNotifId;

  before(async () => {
    try {
      await connectDB();
    } catch (e) {
      console.warn('DB connect error in test:', e.message);
    }
    app = createApp();
  });

  after(async () => {
    try {
      if (testNotifId) {
        await Notification.deleteMany({ notificationId: testNotifId });
      }
      await disconnectDB();
    } catch (e) {
      // ignore
    }
  });

  it('GET /api/notifications should return 200 and pagination structure', async () => {
    const res = await request(app).get('/api/notifications');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(typeof res.body.unreadCount, 'number');
  });

  it('GET /api/notifications/unread-count should return numeric count', async () => {
    const res = await request(app).get('/api/notifications/unread-count');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.unreadCount, 'number');
  });

  it('POST /api/notifications/trigger-event should generate event notification', async () => {
    const res = await request(app)
      .post('/api/notifications/trigger-event')
      .send({
        eventType: 'MACHINE_RISK_HIGH',
        payload: {
          machineId: 'MC-TEST-99',
          riskProbability: 0.88,
          recommendedAction: 'Schedule bearing inspection'
        }
      });

    assert.ok(res.status === 201 || res.status === 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.notification);
    assert.equal(res.body.notification.severity, 'WARNING');
    assert.equal(res.body.notification.category, 'MACHINE_HEALTH');
    assert.equal(res.body.notification.machineId, 'MC-TEST-99');
    testNotifId = res.body.notification.notificationId;
  });

  it('Deduplication: identical high risk event within cooldown should not duplicate', async () => {
    const res = await request(app)
      .post('/api/notifications/trigger-event')
      .send({
        eventType: 'MACHINE_RISK_HIGH',
        payload: {
          machineId: 'MC-TEST-99',
          riskProbability: 0.88,
          recommendedAction: 'Schedule bearing inspection'
        }
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.deduplicated, true);
  });

  it('PATCH /api/notifications/:id/read should mark notification as read', async () => {
    if (!testNotifId) return;
    const res = await request(app).patch(`/api/notifications/${testNotifId}/read`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.isRead, true);
  });

  it('PATCH /api/notifications/read-all should mark all as read', async () => {
    const res = await request(app).patch('/api/notifications/read-all');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('Integration: POST /api/work-orders should automatically generate WORK_ORDER_CREATED notification', async () => {
    // 0. Ensure test machine exists
    await Machine.findOneAndUpdate(
      { machineId: 'MCH-TEST-01' },
      { machineId: 'MCH-TEST-01', name: 'Test Machine 01', machineType: 'CNC_MILL', location: 'Plant A', status: 'operational', criticality: 'high', downtimeCostPerHour: 800 },
      { upsert: true, new: true }
    );

    // 1. Create a work order for existing machine
    const woRes = await request(app)
      .post('/api/work-orders')
      .send({
        machineId: 'MCH-TEST-01',
        title: 'Integration Test Work Order',
        description: 'Auto-test inspection procedures',
        priority: 'high',
        assignedTo: 'Alex Rivera (Lead Mechatronics)'
      });

    assert.equal(woRes.status, 201);
    const createdWo = woRes.body.data;
    assert.ok(createdWo.workOrderId);

    // 2. Fetch notifications and verify WORK_ORDER_CREATED notification exists
    const notifRes = await request(app)
      .get(`/api/notifications?workOrderId=${createdWo.workOrderId}`);
    assert.equal(notifRes.status, 200);

    const match = notifRes.body.data.find(n => n.eventType === 'WORK_ORDER_CREATED' && n.workOrderId === createdWo.workOrderId);
    assert.ok(match, 'WORK_ORDER_CREATED notification should exist in DB');
    assert.equal(match.category, 'WORK_ORDER');
    assert.equal(match.machineId, 'MCH-TEST-01');

    // 3. Complete the work order and verify WORK_ORDER_COMPLETED notification
    const completeRes = await request(app)
      .patch(`/api/work-orders/${createdWo.workOrderId}/status`)
      .send({ status: 'completed', resolutionNotes: 'Inspection verified clean', force: true });
    assert.equal(completeRes.status, 200);

    const completedNotifRes = await request(app)
      .get(`/api/notifications?workOrderId=${createdWo.workOrderId}`);
    const completedMatch = completedNotifRes.body.data.find(n => n.eventType === 'WORK_ORDER_COMPLETED' && n.workOrderId === createdWo.workOrderId);
    assert.ok(completedMatch, 'WORK_ORDER_COMPLETED notification should exist in DB');
    assert.equal(completedMatch.severity, 'SUCCESS');
    assert.equal(completedMatch.category, 'MAINTENANCE');
  });
});
