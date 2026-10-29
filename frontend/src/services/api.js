/**
 * PredictX API Service & Future Integration Boundary.
 *
 * NOTE: As required by DEV-P04 specification:
 * - This file centralizes all backend endpoints for future live connection.
 * - In this offline demo phase, NO live HTTP requests are sent.
 * - Requests are simulated locally with Promise resolution to allow realistic
 *   async/loading states and easy drop-in replacement with real fetch/axios later.
 *
 * Endpoints targeted for future backend:
 * - GET /api/dashboard/summary
 * - GET /api/machines
 * - GET /api/machines/:machineId
 * - GET /api/machines/:machineId/sensors?limit=50
 * - GET /api/machine-priorities
 * - POST /api/predict
 * - GET /api/work-orders
 * - POST /api/work-orders
 * - PATCH /api/work-orders/:workOrderId/status
 * - GET /api/model-metrics
 */

import { initialMachines, generateSensorHistory } from '../data/machines';
import { initialWorkOrders } from '../data/workOrders';
import { initialPredictions, modelEvaluationMetrics } from '../data/predictions';
import { initialMaintenanceHistory } from '../data/maintenanceHistory';
import { initialAlerts } from '../data/alerts';

// Priority formula calculation from Project Blueprint Section 3 & 5:
// Priority Score = 0.50 * Risk + 0.25 * Criticality + 0.15 * Production Impact + 0.10 * Urgency
export function calculatePriorityScore(machine, weights = { risk: 0.50, criticality: 0.25, impact: 0.15, urgency: 0.10 }) {
  const risk = machine.riskScore || 0;
  const crit = machine.criticalityScore || 50;
  const impact = machine.productionImpact || 50;
  const urgency = machine.urgency || 50;

  const score = Math.round(
    (weights.risk * risk) +
    (weights.criticality * crit) +
    (weights.impact * impact) +
    (weights.urgency * urgency)
  );

  let band = "Low";
  let action = "Routine monitoring";
  if (score >= 80) {
    band = "Critical";
    action = "Review immediately";
  } else if (score >= 60) {
    band = "High";
    action = "Plan priority inspection";
  } else if (score >= 35) {
    band = "Medium";
    action = "Monitor and schedule";
  }

  return { score, band, action, risk, crit, impact, urgency };
}

export const api = {
  // GET /api/dashboard/summary
  async getDashboardSummary(machines, workOrders) {
    await simulateLatency(120);
    const total = machines.length;
    const operational = machines.filter(m => m.status === 'Operational').length;
    const highRisk = machines.filter(m => m.riskScore >= 60).length;
    const openWorkOrders = workOrders.filter(w => ['Draft', 'Approved', 'In Progress'].includes(w.status)).length;

    const healthDistribution = [
      { name: 'Healthy (0-35 Risk)', count: machines.filter(m => m.riskScore < 35).length, color: '#43D17D' },
      { name: 'Warning (35-65 Risk)', count: machines.filter(m => m.riskScore >= 35 && m.riskScore < 65).length, color: '#F5B942' },
      { name: 'Critical (65+ Risk)', count: machines.filter(m => m.riskScore >= 65).length, color: '#FF5B64' },
    ];

    return {
      total,
      operational,
      highRisk,
      openWorkOrders,
      healthDistribution,
      lastUpdated: new Date().toLocaleTimeString(),
      dataSource: "NASA C-MAPSS FD001 Subsample Replay + Sensor Gateway"
    };
  },

  // GET /api/machines
  async getMachines() {
    await simulateLatency(150);
    return [...initialMachines];
  },

  // GET /api/machines/:machineId
  async getMachineById(machineId, machinesList = initialMachines) {
    await simulateLatency(100);
    const machine = machinesList.find(m => m.id === machineId);
    if (!machine) throw new Error(`Machine ${machineId} not found`);
    return machine;
  },

  // GET /api/machines/:machineId/sensors?limit=50
  async getSensorHistory(machineId, count = 35) {
    await simulateLatency(180);
    return generateSensorHistory(machineId, count);
  },

  // GET /api/machine-priorities
  async getMachinePriorities(machinesList = initialMachines, weights) {
    await simulateLatency(120);
    return machinesList.map(m => {
      const p = calculatePriorityScore(m, weights);
      return {
        ...m,
        priorityScore: p.score,
        priorityTier: p.band,
        suggestedAction: p.action,
        factors: p
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  },

  // GET /api/work-orders
  async getWorkOrders() {
    await simulateLatency(120);
    return [...initialWorkOrders];
  },

  // POST /api/predict
  async triggerPrediction(machineId) {
    await simulateLatency(400);
    return {
      id: `PRED-SIM-${Date.now().toString().slice(-4)}`,
      machineId,
      timestamp: new Date().toISOString(),
      simulated: true,
      message: "Simulated prediction returned from local inference pipeline"
    };
  },

  // GET /api/model-metrics
  async getModelMetrics() {
    await simulateLatency(100);
    return { ...modelEvaluationMetrics };
  },

  // GET /api/maintenance-history
  async getMaintenanceHistory() {
    await simulateLatency(100);
    return [...initialMaintenanceHistory];
  },

  // GET /api/alerts
  async getAlerts() {
    await simulateLatency(80);
    return [...initialAlerts];
  }
};

function simulateLatency(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
