import { Machine } from '../models/Machine.js';
import { Prediction } from '../models/Prediction.js';
import { calculateMachinePriority } from '../services/priorityService.js';
import { env } from '../config/env.js';

/**
 * GET /api/machine-priorities
 * Ranks machines by maintenance priority using multi-factor business scoring.
 */
export async function getMachinePriorities(req, res, next) {
  try {
    const { status, criticality, minPriority } = req.query;

    const query = {};
    if (status) query.status = status;
    if (criticality) query.criticality = criticality;

    // 1. Fetch machines matching query
    const machines = await Machine.find(query).lean();

    if (machines.length === 0) {
      return res.json({
        success: true,
        count: 0,
        formula: getFormulaDocumentation(),
        data: []
      });
    }

    // 2. Fetch latest prediction for each machine
    const machineIds = machines.map((m) => m.machineId);
    const latestPredictions = await Prediction.aggregate([
      { $match: { machineId: { $in: machineIds } } },
      { $sort: { predictionTimestamp: -1 } },
      {
        $group: {
          _id: '$machineId',
          latest: { $first: '$$ROOT' }
        }
      }
    ]);

    const predictionMap = new Map();
    for (const item of latestPredictions) {
      predictionMap.set(item._id, item.latest);
    }

    // 3. Evaluate priorities
    let ranked = machines.map((machine) => {
      const pred = predictionMap.get(machine.machineId) || null;
      return calculateMachinePriority(machine, pred);
    });

    // 4. Filter by minimum priority if requested
    if (minPriority) {
      const threshold = parseInt(minPriority, 10);
      if (!isNaN(threshold)) {
        ranked = ranked.filter((m) => m.priorityEvaluation.priorityScore >= threshold);
      }
    }

    // 5. Sort descending by priorityScore
    ranked.sort((a, b) => b.priorityEvaluation.priorityScore - a.priorityEvaluation.priorityScore);

    res.json({
      success: true,
      count: ranked.length,
      formula: getFormulaDocumentation(),
      data: ranked
    });
  } catch (err) {
    next(err);
  }
}

function getFormulaDocumentation() {
  return {
    formula: 'PriorityScore = (wRisk * RiskScore) + (wCrit * CriticalityScore) + (wCost * CostScore) + (wRecency * RecencyScore)',
    weights: {
      wRisk: env.PRIORITY_WEIGHT_RISK,
      wCriticality: env.PRIORITY_WEIGHT_CRITICALITY,
      wCost: env.PRIORITY_WEIGHT_COST,
      wRecency: env.PRIORITY_WEIGHT_RECENCY
    },
    benchmarkMaxCost: env.BENCHMARK_MAX_DOWNTIME_COST,
    notes: 'Heuristic business priority score is an operational dispatch index (0-100) combining model risk with financial & operational impact. It is separate from raw model failure probability.'
  };
}
