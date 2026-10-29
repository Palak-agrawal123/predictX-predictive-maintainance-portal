import { env } from '../config/env.js';

const CRITICALITY_SCORES = {
  critical: 1.0,
  high: 0.75,
  medium: 0.45,
  low: 0.20
};

const STATUS_RISK_DEFAULTS = {
  critical: 0.90,
  degraded: 0.65,
  maintenance: 0.40,
  operational: 0.10,
  offline: 0.05
};

/**
 * Calculates multi-factor business maintenance priority score.
 * Strictly separates raw ML risk from business priority score.
 */
export function calculateMachinePriority(machine, latestPrediction = null) {
  const wRisk = env.PRIORITY_WEIGHT_RISK;
  const wCrit = env.PRIORITY_WEIGHT_CRITICALITY;
  const wCost = env.PRIORITY_WEIGHT_COST;
  const wRecency = env.PRIORITY_WEIGHT_RECENCY;
  const maxCost = env.BENCHMARK_MAX_DOWNTIME_COST;

  // 1. Raw Model Risk Score (or fallback from status)
  let rawRiskScore = 0.10;
  let riskSource = 'Machine default status';

  if (latestPrediction && latestPrediction.predictionResult) {
    rawRiskScore = latestPrediction.predictionResult.riskProbability;
    riskSource = latestPrediction.isMock ? 'Mock heuristic prediction' : 'Live ML model inference';
  } else if (STATUS_RISK_DEFAULTS[machine.status] !== undefined) {
    rawRiskScore = STATUS_RISK_DEFAULTS[machine.status];
  }

  // 2. Machine Criticality Score
  const critScore = CRITICALITY_SCORES[machine.criticality] || 0.45;

  // 3. Downtime Cost Score (normalized against max benchmark)
  const costScore = Math.min(1.0, (machine.downtimeCostPerHour || 0) / maxCost);

  // 4. Maintenance Recency Score (normalized: 180 days = 1.0)
  const daysSinceMaint = machine.daysSinceLastMaintenance ?? 30;
  const recencyScore = Math.min(1.0, daysSinceMaint / 180);

  // 5. Multi-factor formula calculation
  const compositeScore = (wRisk * rawRiskScore) + (wCrit * critScore) + (wCost * costScore) + (wRecency * recencyScore);
  const priorityScore = Math.round(compositeScore * 100);

  // 6. Generate human-readable reasons explaining the prioritization
  const reasons = [];

  if (rawRiskScore >= 0.70) {
    reasons.push(`High failure risk (${(rawRiskScore * 100).toFixed(1)}%) from ${riskSource} contributes ${Math.round(wRisk * rawRiskScore * 100)} pts`);
  } else if (rawRiskScore >= 0.40) {
    reasons.push(`Moderate failure risk (${(rawRiskScore * 100).toFixed(1)}%) contributes ${Math.round(wRisk * rawRiskScore * 100)} pts`);
  }

  if (machine.criticality === 'critical' || machine.criticality === 'high') {
    reasons.push(`Asset operational criticality is rated '${machine.criticality.toUpperCase()}' (+${Math.round(wCrit * critScore * 100)} pts)`);
  }

  if (machine.downtimeCostPerHour >= 3000) {
    reasons.push(`Substantial downtime financial impact of $${machine.downtimeCostPerHour.toLocaleString()}/hr (+${Math.round(wCost * costScore * 100)} pts)`);
  }

  if (daysSinceMaint >= 90) {
    reasons.push(`${daysSinceMaint} days elapsed since last maintenance cycle (+${Math.round(wRecency * recencyScore * 100)} pts)`);
  }

  if (reasons.length === 0) {
    reasons.push('Asset is currently within baseline operational parameters with low failure likelihood');
  }

  // 7. Assign priority tier
  let priorityTier = 'LOW';
  if (priorityScore >= 70) {
    priorityTier = 'URGENT';
  } else if (priorityScore >= 50) {
    priorityTier = 'HIGH';
  } else if (priorityScore >= 30) {
    priorityTier = 'MEDIUM';
  }

  return {
    machineId: machine.machineId,
    name: machine.name,
    machineType: machine.machineType,
    location: machine.location,
    status: machine.status,
    criticality: machine.criticality,
    downtimeCostPerHour: machine.downtimeCostPerHour,
    daysSinceLastMaintenance: daysSinceMaint,
    
    // Explicit separation of raw ML output from heuristic business priority
    rawModelRisk: {
      riskProbability: rawRiskScore,
      riskLevel: latestPrediction?.predictionResult?.riskLevel || 'unknown',
      suspectedFailureMode: latestPrediction?.predictionResult?.suspectedFailureMode || 'None',
      source: riskSource,
      isMock: latestPrediction?.isMock ?? true,
      lastEvaluated: latestPrediction?.predictionTimestamp || machine.updatedAt
    },

    priorityEvaluation: {
      priorityScore,
      priorityTier,
      componentScores: {
        riskScore: Math.round(rawRiskScore * 100),
        criticalityScore: Math.round(critScore * 100),
        costScore: Math.round(costScore * 100),
        recencyScore: Math.round(recencyScore * 100)
      },
      reasons,
      disclaimer: 'Priority score is a weighted operational dispatch index, NOT a calibrated failure probability.'
    }
  };
}
