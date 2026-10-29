import { Machine } from '../models/Machine.js';
import { Prediction } from '../models/Prediction.js';
import { WorkOrder } from '../models/WorkOrder.js';
import { ModelEvaluation } from '../models/ModelEvaluation.js';
import { mlService } from '../services/mlService.js';

/**
 * GET /api/dashboard/summary
 * Aggregates machine fleet metrics, risk categories, open work orders, and ML engine status.
 */
export async function getDashboardSummary(req, res, next) {
  try {
    const [
      totalMachines,
      machinesByStatus,
      machinesByCriticality,
      openWorkOrdersCount,
      workOrdersByStatus,
      recentPredictions,
      mlHealth
    ] = await Promise.all([
      Machine.countDocuments(),
      Machine.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Machine.aggregate([{ $group: { _id: '$criticality', count: { $sum: 1 } } }]),
      WorkOrder.countDocuments({ status: { $in: ['draft', 'approved', 'in_progress'] } }),
      WorkOrder.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Prediction.find().sort({ predictionTimestamp: -1 }).limit(5).lean(),
      mlService.checkHealth()
    ]);

    // Format status counts with defaults
    const statusCounts = {
      operational: 0,
      degraded: 0,
      critical: 0,
      maintenance: 0,
      offline: 0
    };
    machinesByStatus.forEach((item) => {
      if (statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
    });

    // Format criticality counts with defaults
    const criticalityCounts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    machinesByCriticality.forEach((item) => {
      if (criticalityCounts[item._id] !== undefined) {
        criticalityCounts[item._id] = item.count;
      }
    });

    // Calculate fleet risk categories using latest predictions per machine
    const latestPredictionsGrouped = await Prediction.aggregate([
      { $sort: { predictionTimestamp: -1 } },
      {
        $group: {
          _id: '$machineId',
          latestRiskLevel: { $first: '$predictionResult.riskLevel' },
          latestRiskProb: { $first: '$predictionResult.riskProbability' }
        }
      }
    ]);

    const riskCategoryCounts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      unevaluated: 0
    };

    const evaluatedMachineSet = new Set();
    latestPredictionsGrouped.forEach((p) => {
      evaluatedMachineSet.add(p._id);
      if (riskCategoryCounts[p.latestRiskLevel] !== undefined) {
        riskCategoryCounts[p.latestRiskLevel]++;
      }
    });

    riskCategoryCounts.unevaluated = Math.max(0, totalMachines - evaluatedMachineSet.size);

    // Format work orders by status
    const workOrderStatusMap = {
      draft: 0,
      approved: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0
    };
    workOrdersByStatus.forEach((w) => {
      if (workOrderStatusMap[w._id] !== undefined) {
        workOrderStatusMap[w._id] = w.count;
      }
    });

    res.json({
      success: true,
      timestamp: new Date(),
      data: {
        fleetOverview: {
          totalMachines,
          statusDistribution: statusCounts,
          criticalityDistribution: criticalityCounts,
          riskDistribution: {
            counts: riskCategoryCounts,
            definitions: {
              low: 'Failure risk < 0.25 (Stable, no intervention needed)',
              medium: 'Failure risk 0.25 - 0.49 (Watchlist, inspect in next routine maintenance)',
              high: 'Failure risk 0.50 - 0.79 (Elevated risk, schedule inspection within 7-14 days)',
              critical: 'Failure risk >= 0.80 (Imminent failure signal, immediate inspection recommended)',
              unevaluated: 'No sensor prediction recorded yet'
            }
          }
        },
        workOrders: {
          totalOpen: openWorkOrdersCount,
          byStatus: workOrderStatusMap
        },
        recentPredictions,
        mlEngine: {
          status: mlHealth.online ? 'CONNECTED' : 'FALLBACK_MOCK_ACTIVE',
          isRealMLEngineOnline: mlHealth.online,
          details: mlHealth
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/model-metrics
 * Exposes validated model evaluation benchmarks only when available.
 */
export async function getModelMetrics(req, res, next) {
  try {
    const evaluations = await ModelEvaluation.find().sort({ evaluatedAt: -1 }).lean();

    if (!evaluations || evaluations.length === 0) {
      return res.json({
        success: true,
        message: 'No model evaluation metrics currently recorded in database. Train or evaluate models to populate.',
        data: []
      });
    }

    res.json({
      success: true,
      count: evaluations.length,
      data: evaluations
    });
  } catch (err) {
    next(err);
  }
}
