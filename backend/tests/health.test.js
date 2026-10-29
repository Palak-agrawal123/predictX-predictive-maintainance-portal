import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';

describe('Health API Tests', () => {
  let app;

  before(async () => {
    await connectDB();
    app = createApp();
  });

  after(async () => {
    await disconnectDB();
  });

  it('GET /api/health should return 200 and system health status', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
    assert.equal(res.body.service, 'predictive-maintenance-backend');
    assert.ok(res.body.components.database);
    assert.equal(res.body.components.database.status, 'connected');
    assert.ok(res.body.components.mlMicroservice);
  });

  it('GET / should return 200 and service welcome info', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Predictive Maintenance Portal API (DEV-P04)');
  });
});
