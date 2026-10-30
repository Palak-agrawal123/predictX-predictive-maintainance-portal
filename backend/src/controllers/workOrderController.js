import { WorkOrder } from '../models/WorkOrder.js';
import { Machine } from '../models/Machine.js';
import { Prediction } from '../models/Prediction.js';
import { notificationService } from '../services/notificationService.js';
import { AppError } from '../middleware/errorHandler.js';

// Valid status lifecycle transitions
const VALID_TRANSITIONS = {
  draft: ['approved', 'cancelled'],
  approved: ['in_progress', 'cancelled', 'draft'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['draft']
};

/**
 * POST /api/work-orders
 * Draft a new maintenance work order
 */
export async function createWorkOrder(req, res, next) {
  try {
    const { machineId, predictionId, title, description, priority, assignedTo, scheduledDate } = req.body;
    const cleanMachineId = machineId.trim().toUpperCase();

    // 1. Ensure referenced machine exists
    const machine = await Machine.findOne({ machineId: cleanMachineId });
    if (!machine) {
      return next(new AppError(`Referenced machine '${cleanMachineId}' does not exist`, 404));
    }

    // 2. Validate predictionId if provided & use approved human maintenance priority
    let resolvedPriority = priority;
    if (predictionId) {
      const prediction = await Prediction.findOne({ predictionId });
      if (!prediction) {
        return next(new AppError(`Referenced prediction '${predictionId}' not found`, 404));
      }
      if (!resolvedPriority) {
        const approvedPriority = prediction.maintenancePriority || prediction.predictedRisk;
        if (approvedPriority) {
          resolvedPriority = approvedPriority.toLowerCase() === 'critical' ? 'urgent' : approvedPriority.toLowerCase();
        }
      }
    }

    // 3. Generate unique Work Order ID
    let workOrderId;
    let isUnique = false;
    let offset = 0;
    const baseCount = await WorkOrder.countDocuments();
    while (!isUnique) {
      workOrderId = `WO-${String(baseCount + 1001 + offset).padStart(5, '0')}`;
      const existing = await WorkOrder.exists({ workOrderId });
      if (!existing) {
        isUnique = true;
      } else {
        offset++;
      }
    }

    // 4. Create record in 'draft' status by default
    const workOrder = new WorkOrder({
      workOrderId,
      machineId: cleanMachineId,
      predictionId: predictionId || null,
      title,
      description,
      priority: (resolvedPriority || 'medium').toLowerCase(),
      status: 'draft',
      assignedTo: assignedTo || 'Unassigned',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined
    });

    await workOrder.save();

    // Generate Work Order Created event notification
    try {
      await notificationService.dispatchEvent('WORK_ORDER_CREATED', {
        workOrderId: workOrder.workOrderId,
        machineId: cleanMachineId,
        title: workOrder.title,
        priority: workOrder.priority,
        relatedEntityType: 'WorkOrder',
        relatedEntityId: workOrder.workOrderId
      });

      if (workOrder.assignedTo && workOrder.assignedTo !== 'Unassigned') {
        await notificationService.dispatchEvent('WORK_ORDER_ASSIGNED', {
          workOrderId: workOrder.workOrderId,
          machineId: cleanMachineId,
          assignedTo: workOrder.assignedTo,
          scheduledDate: workOrder.scheduledDate ? workOrder.scheduledDate.toISOString().slice(0, 10) : 'Upcoming',
          relatedEntityType: 'WorkOrder',
          relatedEntityId: workOrder.workOrderId
        });
      }
    } catch (notifErr) {
      console.warn('[Notification Warning] createWorkOrder notification failed:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Draft work order created successfully',
      data: workOrder
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/work-orders
 * List work orders with optional filtering by machineId, status, priority
 */
export async function getAllWorkOrders(req, res, next) {
  try {
    const { machineId, status, priority, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (machineId) filter.machineId = machineId.toUpperCase();
    if (status) {
      const cleanStatus = status.trim();
      if (cleanStatus.startsWith('!')) {
        filter.status = { $ne: cleanStatus.slice(1).trim().toLowerCase() };
      } else if (cleanStatus.includes(',')) {
        filter.status = { $in: cleanStatus.split(',').map(s => s.trim().toLowerCase()) };
      } else {
        filter.status = cleanStatus.toLowerCase();
      }
    }
    if (priority) filter.priority = priority.toLowerCase();

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [total, workOrders] = await Promise.all([
      WorkOrder.countDocuments(filter),
      WorkOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    res.json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      count: workOrders.length,
      data: workOrders
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/work-orders/:id
 * Retrieve single work order by workOrderId or _id
 */
export async function getWorkOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { workOrderId: id }] }
      : { workOrderId: id };

    const workOrder = await WorkOrder.findOne(query).lean();

    if (!workOrder) {
      return next(new AppError(`Work order not found with ID: ${id}`, 404));
    }

    // Attach machine info for context
    const machine = await Machine.findOne({ machineId: workOrder.machineId })
      .select('name machineType location status criticality downtimeCostPerHour')
      .lean();

    res.json({
      success: true,
      data: {
        ...workOrder,
        machineDetails: machine || null
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/work-orders/:id
 * Update work order general fields (title, description, priority, assignedTo, scheduledDate, resolutionNotes)
 */
export async function updateWorkOrder(req, res, next) {
  try {
    const { id } = req.params;
    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { workOrderId: id }] }
      : { workOrderId: id };

    const updates = { ...req.body };
    delete updates.workOrderId;
    delete updates.machineId; // Immutable to prevent decoupling
    delete updates._id;

    // Disallow arbitrary status skipping in general update
    delete updates.status;

    // Retrieve existing to detect priority and assignment changes
    const existingWorkOrder = await WorkOrder.findOne(query).lean();
    if (!existingWorkOrder) {
      return next(new AppError(`Work order not found with ID: ${id}`, 404));
    }

    const workOrder = await WorkOrder.findOneAndUpdate(query, updates, {
      new: true,
      runValidators: true
    });

    if (!workOrder) {
      return next(new AppError(`Work order not found with ID: ${id}`, 404));
    }

    // Detect priority escalation or reassignment
    try {
      if (updates.priority && updates.priority.toLowerCase() !== existingWorkOrder.priority?.toLowerCase()) {
        await notificationService.dispatchEvent('WORK_ORDER_PRIORITY_CHANGED', {
          workOrderId: workOrder.workOrderId,
          machineId: workOrder.machineId,
          newPriority: workOrder.priority,
          previousPriority: existingWorkOrder.priority,
          relatedEntityType: 'WorkOrder',
          relatedEntityId: workOrder.workOrderId
        });
      }

      if (updates.assignedTo && updates.assignedTo !== existingWorkOrder.assignedTo && updates.assignedTo !== 'Unassigned') {
        await notificationService.dispatchEvent('WORK_ORDER_ASSIGNED', {
          workOrderId: workOrder.workOrderId,
          machineId: workOrder.machineId,
          assignedTo: workOrder.assignedTo,
          scheduledDate: workOrder.scheduledDate ? workOrder.scheduledDate.toISOString().slice(0, 10) : 'Upcoming',
          relatedEntityType: 'WorkOrder',
          relatedEntityId: workOrder.workOrderId
        });
      }
    } catch (notifErr) {
      console.warn('[Notification Warning] updateWorkOrder notification failed:', notifErr.message);
    }

    res.json({
      success: true,
      message: 'Work order updated successfully',
      data: workOrder
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/work-orders/:id/status
 * Transition work order status (approved, in_progress, completed, cancelled)
 */
export async function updateWorkOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status: newStatus, resolutionNotes, force } = req.body;

    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { $or: [{ _id: id }, { workOrderId: id }] }
      : { workOrderId: id };

    const workOrder = await WorkOrder.findOne(query);

    if (!workOrder) {
      return next(new AppError(`Work order not found with ID: ${id}`, 404));
    }

    const currentStatus = workOrder.status;
    const targetStatus = newStatus?.toLowerCase()?.trim();
    const validStatuses = ['draft', 'approved', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(targetStatus)) {
      return next(
        new AppError(
          `Invalid status '${newStatus}'. Allowed: ${validStatuses.join(', ')}`,
          400
        )
      );
    }

    // Validate lifecycle transition (allows direct override when force is true)
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!force && !allowed.includes(targetStatus)) {
      return next(
        new AppError(
          `Invalid state transition: Cannot change status from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${allowed.join(', ') || 'None (terminal state)'}`,
          400,
          { currentStatus, requestedStatus: targetStatus, allowedTransitions: allowed }
        )
      );
    }

    workOrder.status = targetStatus;

    if (targetStatus === 'completed') {
      workOrder.completedAt = workOrder.completedAt || new Date();
      if (resolutionNotes) {
        workOrder.resolutionNotes = resolutionNotes;
      }
    } else {
      if (resolutionNotes) {
        workOrder.resolutionNotes = resolutionNotes;
      }
    }

    await workOrder.save();

    // Dispatch status transition event
    try {
      if (targetStatus === 'in_progress') {
        await notificationService.dispatchEvent('WORK_ORDER_IN_PROGRESS', {
          workOrderId: workOrder.workOrderId,
          machineId: workOrder.machineId,
          relatedEntityType: 'WorkOrder',
          relatedEntityId: workOrder.workOrderId
        });
      } else if (targetStatus === 'completed') {
        await notificationService.dispatchEvent('WORK_ORDER_COMPLETED', {
          workOrderId: workOrder.workOrderId,
          machineId: workOrder.machineId,
          relatedEntityType: 'WorkOrder',
          relatedEntityId: workOrder.workOrderId
        });
      } else if (targetStatus === 'cancelled') {
        await notificationService.dispatchEvent('WORK_ORDER_CANCELLED', {
          workOrderId: workOrder.workOrderId,
          machineId: workOrder.machineId,
          relatedEntityType: 'WorkOrder',
          relatedEntityId: workOrder.workOrderId
        });
      }
    } catch (notifErr) {
      console.warn('[Notification Warning] updateWorkOrderStatus event failed:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Work order transitioned from '${currentStatus}' to '${targetStatus}'`,
      data: workOrder
    });
  } catch (err) {
    next(err);
  }
}
