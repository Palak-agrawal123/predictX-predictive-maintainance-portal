import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Prediction } from '../src/models/Prediction.js';
import { ReviewAudit } from '../src/models/ReviewAudit.js';

describe('Human-in-the-Loop Review & Priority Override API Tests', () => {
  let app;
  let testPredHighId;
  let testPredHigh2Id;
  let testPredConfirmId;

  before(async () => {
    await connectDB();
    app = createApp();

    // Create 3 fresh test predictions with HIGH predicted risk
    const pred1 = new Prediction({
      predictionId: `PRD-TEST-${Date.now()}-01`,
      machineId: 'MCH-CNC-101',
      predictionType: 'failure_risk_classification',
      predictionResult: {
        riskProbability: 0.88,
        riskLevel: 'high',
        healthScore: 22,
        estimatedRULDays: 8,
        suspectedFailureMode: 'Tool Wear Failure (TWF)',
        recommendedAction: 'Immediate inspection of spindle and tooling'
      },
      predictedRisk: 'HIGH',
      maintenancePriority: 'HIGH',
      reviewStatus: 'PENDING',
      isOverridden: false,
      modelVersion: 'xgb-ai4i-v1.2.0',
      isMock: false,
      executionSource: 'ml_service_fastapi',
      inputFeatures: { airTemperature: 300, vibration: 4.2 }
    });
    await pred1.save();
    testPredHighId = pred1.predictionId;

    const pred2 = new Prediction({
      predictionId: `PRD-TEST-${Date.now()}-02`,
      machineId: 'MCH-HYD-202',
      predictionType: 'failure_risk_classification',
      predictionResult: {
        riskProbability: 0.85,
        riskLevel: 'high',
        healthScore: 25,
        estimatedRULDays: 10,
        suspectedFailureMode: 'Overstrain Failure (OSF)',
        recommendedAction: 'Inspect hydraulic manifold pressure'
      },
      predictedRisk: 'HIGH',
      maintenancePriority: 'HIGH',
      reviewStatus: 'PENDING',
      isOverridden: false,
      modelVersion: 'xgb-ai4i-v1.2.0',
      isMock: false,
      executionSource: 'ml_service_fastapi',
      inputFeatures: { torque: 62.0, vibration: 3.8 }
    });
    await pred2.save();
    testPredHigh2Id = pred2.predictionId;

    const pred3 = new Prediction({
      predictionId: `PRD-TEST-${Date.now()}-03`,
      machineId: 'MCH-TUR-303',
      predictionType: 'failure_risk_classification',
      predictionResult: {
        riskProbability: 0.92,
        riskLevel: 'critical',
        healthScore: 12,
        estimatedRULDays: 4,
        suspectedFailureMode: 'Bearing Thermal Distress',
        recommendedAction: 'Emergency shutdown and bearing replacement'
      },
      predictedRisk: 'HIGH',
      maintenancePriority: 'HIGH',
      reviewStatus: 'PENDING',
      isOverridden: false,
      modelVersion: 'xgb-ai4i-v1.2.0',
      isMock: false,
      executionSource: 'ml_service_fastapi',
      inputFeatures: { processTemperature: 325, vibration: 5.4 }
    });
    await pred3.save();
    testPredConfirmId = pred3.predictionId;
  });

  after(async () => {
    // Clean up test predictions and audits
    const testIds = [testPredHighId, testPredHigh2Id, testPredConfirmId].filter(Boolean);
    await Prediction.deleteMany({ predictionId: { $in: testIds } });
    await ReviewAudit.deleteMany({ predictionId: { $in: testIds } });
    await disconnectDB();
  });

  it('GET /api/reviews/pending should return unreviewed predictions marked as PENDING', async () => {
    const res = await request(app).get('/api/reviews/pending');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const found = res.body.data.find(p => p.predictionId === testPredHighId);
    assert.ok(found, 'Created test prediction should be in pending review list');
    assert.equal(found.reviewStatus, 'PENDING');
    assert.equal(found.isOverridden, false);
    assert.equal(found.predictedRisk, 'HIGH');
    assert.equal(found.maintenancePriority, 'HIGH');
  });

  it('POST /api/reviews/:id/override should reject request if review reason is missing', async () => {
    const res = await request(app)
      .post(`/api/reviews/${testPredHighId}/override`)
      .send({
        newPriority: 'MEDIUM',
        reviewedBy: 'Chief Inspector'
        // Missing mandatory 'reason'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.message.includes('reason is mandatory'));
  });

  it('POST /api/reviews/:id/override should reject request if priority is invalid', async () => {
    const res = await request(app)
      .post(`/api/reviews/${testPredHighId}/override`)
      .send({
        newPriority: 'SUPER_URGENT_INVALID',
        reason: 'Testing invalid priority rejection',
        reviewedBy: 'Chief Inspector'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.message.includes('Invalid priority'));
  });

  it('POST /api/reviews/:id/override should change HIGH ML prediction to MEDIUM while preserving original ML output', async () => {
    const res = await request(app)
      .post(`/api/reviews/${testPredHighId}/override`)
      .send({
        newPriority: 'MEDIUM',
        reason: 'Physical vibration survey confirmed baseline sensor drift only; no bearing spalling found.',
        reviewedBy: 'Marcus Vance (Senior Mechatronics)'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.prediction.maintenancePriority, 'MEDIUM');
    assert.equal(res.body.data.prediction.predictedRisk, 'HIGH', 'Original ML predictedRisk must remain unchanged');
    assert.equal(res.body.data.prediction.predictionResult.riskLevel, 'high', 'Raw ML riskLevel must not be overwritten');
    assert.equal(res.body.data.prediction.isOverridden, true);
    assert.equal(res.body.data.prediction.reviewStatus, 'REVIEWED');
    assert.equal(res.body.data.prediction.reviewedBy, 'Marcus Vance (Senior Mechatronics)');
    assert.ok(res.body.data.prediction.reviewedAt);

    // Verify ReviewAudit record
    assert.equal(res.body.data.audit.action, 'OVERRIDDEN');
    assert.equal(res.body.data.audit.previousPriority, 'HIGH');
    assert.equal(res.body.data.audit.newPriority, 'MEDIUM');
  });

  it('POST /api/reviews/:id/override should change HIGH ML prediction to LOW and update audit history', async () => {
    const res = await request(app)
      .post(`/api/reviews/${testPredHigh2Id}/override`)
      .send({
        newPriority: 'LOW',
        reason: 'Transducer recalibrated after tooling change. Machine operating in full compliance.',
        reviewedBy: 'Elena Rostova (Lead Reliability)'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.prediction.maintenancePriority, 'LOW');
    assert.equal(res.body.data.prediction.predictedRisk, 'HIGH', 'Original ML output must remain intact');
    assert.equal(res.body.data.prediction.isOverridden, true);
    assert.equal(res.body.data.prediction.reviewStatus, 'REVIEWED');

    // Confirm standalone audit was written
    const audit = await ReviewAudit.findOne({ predictionId: testPredHigh2Id });
    assert.ok(audit, 'Audit record must exist in ReviewAudit collection');
    assert.equal(audit.action, 'OVERRIDDEN');
    assert.equal(audit.newPriority, 'LOW');
  });

  it('POST /api/reviews/:id/confirm should confirm HIGH prediction without override', async () => {
    const res = await request(app)
      .post(`/api/reviews/${testPredConfirmId}/confirm`)
      .send({
        reviewedBy: 'Sarah Chen (Turbomachinery Specialist)',
        reason: 'Confirmed elevated thermal telemetry and harmonic vibrations. Concur with HIGH priority dispatch.'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.prediction.maintenancePriority, 'HIGH');
    assert.equal(res.body.data.prediction.predictedRisk, 'HIGH');
    assert.equal(res.body.data.prediction.isOverridden, false, 'Confirmed prediction must have isOverridden = false');
    assert.equal(res.body.data.prediction.reviewStatus, 'REVIEWED');
    assert.equal(res.body.data.audit.action, 'CONFIRMED');
  });

  it('GET /api/reviews should show metrics with pending, reviewed, and overridden counts', async () => {
    const res = await request(app).get('/api/reviews');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.metrics);
    assert.ok(res.body.metrics.reviewedCount >= 3);
    assert.ok(res.body.metrics.overriddenCount >= 2);
  });

  it('GET /api/machine-priorities should reflect human maintenancePriority for reviewed machines', async () => {
    const res = await request(app).get('/api/machine-priorities');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));

    const hydMachine = res.body.data.find(m => m.machineId === 'MCH-HYD-202');
    if (hydMachine && hydMachine.humanReview) {
      assert.equal(hydMachine.humanReview.maintenancePriority, 'LOW');
      assert.equal(hydMachine.rawModelRisk.predictedRisk, 'HIGH');
      assert.equal(hydMachine.humanReview.isOverridden, true);
      assert.equal(hydMachine.humanReview.reviewStatus, 'REVIEWED');
    }
  });

  it('POST /api/work-orders should adopt reviewed human maintenancePriority when linked to prediction', async () => {
    const res = await request(app)
      .post('/api/work-orders')
      .send({
        machineId: 'MCH-HYD-202',
        predictionId: testPredHigh2Id,
        title: 'Calibrate transducer and check seals',
        description: 'Transducer recalibrated after tooling change. Operational priority adjusted to LOW.'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    // Because testPredHigh2Id was overridden from HIGH to LOW, resolved priority must be 'low'
    assert.equal(res.body.data.priority, 'low');
  });

  it('Review history and ReviewAudit collection record every decision sequentially', async () => {
    // Perform a second override on testPredHighId (MEDIUM -> HIGH)
    const secondOverride = await request(app)
      .post(`/api/reviews/${testPredHighId}/override`)
      .send({
        newPriority: 'HIGH',
        reason: 'Secondary acoustic sensor confirmed bearing micro-fracture after load test. Reverting to HIGH.',
        reviewedBy: 'Plant Chief Inspector'
      });

    assert.equal(secondOverride.status, 200);
    assert.equal(secondOverride.body.data.prediction.maintenancePriority, 'HIGH');
    assert.equal(secondOverride.body.data.prediction.predictedRisk, 'HIGH');

    // Fetch review by ID and verify auditHistory length >= 2
    const detail = await request(app).get(`/api/reviews/${testPredHighId}`);
    assert.equal(detail.status, 200);
    assert.ok(detail.body.data.auditHistory.length >= 2, 'Must record multiple audit entries');
    const actions = detail.body.data.auditHistory.map(a => a.newPriority);
    assert.ok(actions.includes('MEDIUM') && actions.includes('HIGH'));
  });
});
