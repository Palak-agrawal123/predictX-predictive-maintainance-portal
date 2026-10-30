import { Prediction } from '../models/Prediction.js';
import { Machine } from '../models/Machine.js';
import { ReviewAudit } from '../models/ReviewAudit.js';
import { notificationService } from '../services/notificationService.js';
import { AppError } from '../middleware/errorHandler.js';

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * GET /api/reviews/pending
 * Retrieve all predictions currently pending human review
 */
export async function getPendingReviews(req, res, next) {
  try {
    const { machineId, predictedRisk, limit = 50, page = 1 } = req.query;
    const filter = { reviewStatus: 'PENDING' };

    if (machineId) filter.machineId = machineId.trim().toUpperCase();
    if (predictedRisk) filter.predictedRisk = predictedRisk.trim().toUpperCase();

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [total, predictions] = await Promise.all([
      Prediction.countDocuments(filter),
      Prediction.find(filter)
        .sort({ predictionTimestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    // Enrich predictions with machine metadata
    const machineIds = [...new Set(predictions.map(p => p.machineId))];
    const machines = await Machine.find({ machineId: { $in: machineIds } })
      .select('machineId name machineType location status criticality downtimeCostPerHour')
      .lean();

    const machineMap = new Map();
    machines.forEach(m => machineMap.set(m.machineId, m));

    const enriched = predictions.map(p => ({
      ...p,
      machineDetails: machineMap.get(p.machineId) || null
    }));

    res.json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      count: enriched.length,
      data: enriched
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reviews
 * List predictions with review filtering (pending, reviewed, overridden, risk level)
 */
export async function getAllReviews(req, res, next) {
  try {
    const { status, reviewStatus, predictedRisk, isOverridden, machineId, limit = 50, page = 1 } = req.query;
    const filter = {};

    const targetStatus = reviewStatus || status;
    if (targetStatus && targetStatus !== 'ALL') {
      filter.reviewStatus = targetStatus.trim().toUpperCase();
    }

    if (predictedRisk && predictedRisk !== 'ALL') {
      filter.predictedRisk = predictedRisk.trim().toUpperCase();
    }

    if (isOverridden !== undefined && isOverridden !== 'ALL') {
      filter.isOverridden = isOverridden === 'true' || isOverridden === true;
    }

    if (machineId) {
      filter.machineId = machineId.trim().toUpperCase();
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [total, predictions, pendingCount, reviewedCount, overriddenCount] = await Promise.all([
      Prediction.countDocuments(filter),
      Prediction.find(filter)
        .sort({ predictionTimestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Prediction.countDocuments({ reviewStatus: 'PENDING' }),
      Prediction.countDocuments({ reviewStatus: 'REVIEWED' }),
      Prediction.countDocuments({ isOverridden: true })
    ]);

    const machineIds = [...new Set(predictions.map(p => p.machineId))];
    const machines = await Machine.find({ machineId: { $in: machineIds } })
      .select('machineId name machineType location status criticality downtimeCostPerHour')
      .lean();

    const machineMap = new Map();
    machines.forEach(m => machineMap.set(m.machineId, m));

    const enriched = predictions.map(p => ({
      ...p,
      machineDetails: machineMap.get(p.machineId) || null
    }));

    res.json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      count: enriched.length,
      metrics: {
        totalReviews: pendingCount + reviewedCount,
        pendingCount,
        reviewedCount,
        overriddenCount,
        confirmedCount: reviewedCount - overriddenCount
      },
      data: enriched
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reviews/:id
 * Retrieve single review/prediction with machine details, sensor telemetry, and review history
 */
export async function getReviewById(req, res, next) {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { predictionId: id }] }
      : { predictionId: id };

    const prediction = await Prediction.findOne(query).lean();
    if (!prediction) {
      return next(new AppError(`Prediction record not found with ID: ${id}`, 404));
    }

    const [machine, audits] = await Promise.all([
      Machine.findOne({ machineId: prediction.machineId })
        .select('machineId name machineType location status criticality downtimeCostPerHour operatingParameters')
        .lean(),
      ReviewAudit.find({ predictionId: prediction.predictionId })
        .sort({ reviewedAt: -1 })
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        ...prediction,
        machineDetails: machine || null,
        auditHistory: audits || []
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reviews/:id/confirm
 * Human reviewer confirms the ML-suggested priority without override
 */
export async function confirmPredictionPriority(req, res, next) {
  try {
    const { id } = req.params;
    const { reviewedBy, reason } = req.body || {};

    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { predictionId: id }] }
      : { predictionId: id };

    const prediction = await Prediction.findOne(query);
    if (!prediction) {
      return next(new AppError(`Prediction record not found with ID: ${id}`, 404));
    }

    const reviewer = (reviewedBy && reviewedBy.trim()) || 'Authorized Maintenance Reviewer';
    const confirmReason = (reason && reason.trim()) || 'Confirmed ML predicted risk baseline';
    const now = new Date();

    // 1. Maintain predictedRisk and set maintenancePriority equal to predictedRisk
    const previousPriority = prediction.maintenancePriority || prediction.predictedRisk;
    prediction.maintenancePriority = prediction.predictedRisk;
    prediction.reviewStatus = 'REVIEWED';
    prediction.isOverridden = false;
    prediction.reviewedBy = reviewer;
    prediction.reviewedAt = now;
    prediction.reviewReason = confirmReason;

    // 2. Append event to embedded review history
    const historyEntry = {
      action: 'CONFIRMED',
      previousPriority,
      newPriority: prediction.predictedRisk,
      reason: confirmReason,
      reviewedBy: reviewer,
      reviewedAt: now
    };
    prediction.reviewHistory.push(historyEntry);

    await prediction.save();

    // 3. Create permanent standalone audit record
    const auditRecord = new ReviewAudit({
      predictionId: prediction.predictionId,
      machineId: prediction.machineId,
      previousPriority,
      newPriority: prediction.predictedRisk,
      action: 'CONFIRMED',
      reason: confirmReason,
      reviewedBy: reviewer,
      reviewedAt: now
    });
    await auditRecord.save();

    // Event notification for confirmed human review
    try {
      await notificationService.dispatchEvent('REVIEW_APPROVED', {
        machineId: prediction.machineId,
        predictionId: prediction.predictionId,
        priority: prediction.predictedRisk,
        reviewedBy: reviewer,
        relatedEntityType: 'ReviewAudit',
        relatedEntityId: prediction.predictionId
      });
    } catch (notifErr) {
      console.warn('[Notification Warning] confirmPredictionPriority notification failed:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Prediction ${prediction.predictionId} priority confirmed as ${prediction.predictedRisk}`,
      data: {
        prediction,
        audit: auditRecord
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reviews/:id/override
 * Human reviewer overrides ML priority with mandatory justification reason
 */
export async function overridePredictionPriority(req, res, next) {
  try {
    const { id } = req.params;
    const { newPriority, reason, reviewedBy } = req.body || {};

    // 1. Validate mandatory priority
    if (!newPriority || typeof newPriority !== 'string') {
      return next(new AppError('New maintenance priority is required', 400));
    }

    const cleanNewPriority = newPriority.trim().toUpperCase();
    if (!VALID_PRIORITIES.includes(cleanNewPriority)) {
      return next(
        new AppError(
          `Invalid priority '${newPriority}'. Allowed: ${VALID_PRIORITIES.join(', ')}`,
          400
        )
      );
    }

    // 2. Validate mandatory override reason
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return next(
        new AppError('Review override reason is mandatory when altering priority', 400)
      );
    }

    const cleanReason = reason.trim();

    // 3. Locate prediction
    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { predictionId: id }] }
      : { predictionId: id };

    const prediction = await Prediction.findOne(query);
    if (!prediction) {
      return next(new AppError(`Prediction record not found with ID: ${id}`, 404));
    }

    const reviewer = (reviewedBy && reviewedBy.trim()) || 'Senior Maintenance Engineer';
    const previousPriority = prediction.maintenancePriority || prediction.predictedRisk;
    const now = new Date();

    // 4. Update operational maintenance priority while STRICTLY preserving original predictedRisk
    // Notice: prediction.predictedRisk and prediction.predictionResult REMAIN UNCHANGED
    prediction.maintenancePriority = cleanNewPriority;
    prediction.reviewStatus = 'REVIEWED';
    prediction.isOverridden = true;
    prediction.reviewedBy = reviewer;
    prediction.reviewedAt = now;
    prediction.reviewReason = cleanReason;

    // 5. Append event to embedded review history
    const historyEntry = {
      action: 'OVERRIDDEN',
      previousPriority,
      newPriority: cleanNewPriority,
      reason: cleanReason,
      reviewedBy: reviewer,
      reviewedAt: now
    };
    prediction.reviewHistory.push(historyEntry);

    await prediction.save();

    // 6. Create permanent standalone audit record
    const auditRecord = new ReviewAudit({
      predictionId: prediction.predictionId,
      machineId: prediction.machineId,
      previousPriority,
      newPriority: cleanNewPriority,
      action: 'OVERRIDDEN',
      reason: cleanReason,
      reviewedBy: reviewer,
      reviewedAt: now
    });
    await auditRecord.save();

    // Event notification for overridden human review
    try {
      await notificationService.dispatchEvent('REVIEW_OVERRIDDEN', {
        machineId: prediction.machineId,
        predictionId: prediction.predictionId,
        previousPriority,
        newPriority: cleanNewPriority,
        reason: cleanReason,
        reviewedBy: reviewer,
        relatedEntityType: 'ReviewAudit',
        relatedEntityId: prediction.predictionId
      });
    } catch (notifErr) {
      console.warn('[Notification Warning] overridePredictionPriority notification failed:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Prediction ${prediction.predictionId} priority overridden from ${previousPriority} to ${cleanNewPriority}`,
      data: {
        prediction,
        audit: auditRecord
      }
    });
  } catch (err) {
    next(err);
  }
}
