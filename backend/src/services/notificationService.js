import { Notification } from '../models/Notification.js';

class NotificationService {
  constructor() {
    // Map of active SSE client connections: userId -> Set of res objects
    this.sseClients = new Map();
    // In-memory fallback notification buffer when MongoDB is in offline mode
    this.inMemoryNotifications = [];
    this.maxInMemory = 100;
  }

  /**
   * Register a real-time Server-Sent Events (SSE) connection
   */
  registerSSEClient(userId, res) {
    const cleanUserId = userId || 'plant_operator_px';
    if (!this.sseClients.has(cleanUserId)) {
      this.sseClients.set(cleanUserId, new Set());
    }
    this.sseClients.get(cleanUserId).add(res);

    // Keep connection alive with periodic comment pings
    const keepAlive = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch (e) {
        clearInterval(keepAlive);
      }
    }, 25000);

    // Clean up when client disconnects
    res.on('close', () => {
      clearInterval(keepAlive);
      const userSet = this.sseClients.get(cleanUserId);
      if (userSet) {
        userSet.delete(res);
        if (userSet.size === 0) {
          this.sseClients.delete(cleanUserId);
        }
      }
    });
  }

  /**
   * Broadcast an event to connected users via SSE
   */
  broadcastToUser(userId, eventName, payload) {
    const sendToSet = (clientSet) => {
      if (!clientSet) return;
      const dataStr = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
      for (const res of clientSet) {
        try {
          res.write(dataStr);
        } catch (err) {
          console.warn('[SSE Warning] Failed to write event to client:', err.message);
        }
      }
    };

    if (userId) {
      sendToSet(this.sseClients.get(userId));
    }
    // Also broadcast to the default plant operator PX
    if (userId !== 'plant_operator_px') {
      sendToSet(this.sseClients.get('plant_operator_px'));
    }
  }

  /**
   * Generate a unique notification ID: NTF-YYYYMMDD-XXXXX
   */
  generateNotificationId() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `NTF-${dateStr}-${randomHex}`;
  }

  /**
   * Create and persist a new notification with deduplication & real-time broadcast
   */
  async createNotification({
    userId = 'plant_operator_px',
    title,
    message,
    eventType,
    category,
    severity = 'INFO',
    machineId = null,
    workOrderId = null,
    relatedEntityType = null,
    relatedEntityId = null,
    actionUrl = null,
    dedupKey = null,
    cooldownMinutes = 0,
    metadata = {}
  }) {
    try {
      const cleanUserId = userId.trim();

      // 1. Check deduplication and cooldown window
      if (dedupKey && cooldownMinutes > 0) {
        const cooldownThreshold = new Date(Date.now() - cooldownMinutes * 60 * 1000);
        let recentDuplicate = null;

        try {
          recentDuplicate = await Notification.findOne({
            dedupKey,
            createdAt: { $gte: cooldownThreshold }
          }).lean();
        } catch (dbErr) {
          // Check in-memory buffer if DB is offline
          recentDuplicate = this.inMemoryNotifications.find(
            n => n.dedupKey === dedupKey && new Date(n.createdAt) >= cooldownThreshold
          );
        }

        if (recentDuplicate) {
          // Event already active within cooldown window; prevent spam
          return {
            created: false,
            deduplicated: true,
            notification: recentDuplicate
          };
        }
      }

      const notificationId = this.generateNotificationId();

      const notificationDoc = {
        notificationId,
        userId: cleanUserId,
        title: title.trim(),
        message: message.trim(),
        eventType,
        category,
        severity,
        machineId: machineId ? machineId.toUpperCase() : null,
        workOrderId: workOrderId ? workOrderId.toUpperCase() : null,
        relatedEntityType,
        relatedEntityId: relatedEntityId || workOrderId || machineId,
        actionUrl: actionUrl || (machineId ? `/machines/${machineId.toUpperCase()}` : null),
        dedupKey: dedupKey || `${eventType}_${machineId || ''}_${workOrderId || ''}`,
        isRead: false,
        readAt: null,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      let savedNotification = null;

      // 2. Persist to MongoDB
      try {
        const notif = new Notification(notificationDoc);
        savedNotification = await notif.save();
      } catch (dbErr) {
        console.warn('[Notification DB Warning] MongoDB not available. Using in-memory fallback:', dbErr.message);
        savedNotification = { ...notificationDoc, _id: notificationId };
        this.inMemoryNotifications.unshift(savedNotification);
        if (this.inMemoryNotifications.length > this.maxInMemory) {
          this.inMemoryNotifications.pop();
        }
      }

      // 3. Emit real-time SSE push
      this.broadcastToUser(cleanUserId, 'notification:new', savedNotification);

      // 4. Update and broadcast real-time unread count
      const unreadCount = await this.getUnreadCount(cleanUserId);
      this.broadcastToUser(cleanUserId, 'notification:count:update', { unreadCount });

      return {
        created: true,
        deduplicated: false,
        notification: savedNotification
      };
    } catch (err) {
      console.error('[Notification Service Error] Failed to create notification:', err);
      return { created: false, error: err.message };
    }
  }

  /**
   * Retrieve paginated notifications with filters
   */
  async getNotifications({
    userId = 'plant_operator_px',
    isRead,
    category,
    severity,
    eventType,
    machineId,
    page = 1,
    limit = 20
  }) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (userId && userId !== 'ALL') {
      filter.$or = [{ userId }, { userId: 'plant_operator_px' }, { userId: 'ALL' }];
    }
    if (isRead !== undefined && isRead !== null && isRead !== '') {
      filter.isRead = isRead === 'true' || isRead === true;
    }
    if (category && category !== 'ALL') {
      filter.category = category.toUpperCase();
    }
    if (severity && severity !== 'ALL') {
      filter.severity = severity.toUpperCase();
    }
    if (eventType && eventType !== 'ALL') {
      filter.eventType = eventType.toUpperCase();
    }
    if (machineId) {
      filter.machineId = machineId.toUpperCase();
    }

    try {
      const [total, notifications, unreadCount] = await Promise.all([
        Notification.countDocuments(filter),
        Notification.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Notification.countDocuments({ ...filter, isRead: false })
      ]);

      return {
        success: true,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        unreadCount,
        count: notifications.length,
        data: notifications
      };
    } catch (dbErr) {
      // Memory fallback for degraded mode
      let filtered = [...this.inMemoryNotifications];
      if (filter.isRead !== undefined) {
        filtered = filtered.filter(n => n.isRead === filter.isRead);
      }
      if (filter.category) {
        filtered = filtered.filter(n => n.category === filter.category);
      }
      if (filter.severity) {
        filtered = filtered.filter(n => n.severity === filter.severity);
      }
      const unreadCount = filtered.filter(n => !n.isRead).length;
      const paginated = filtered.slice(skip, skip + limitNum);

      return {
        success: true,
        total: filtered.length,
        page: pageNum,
        pages: Math.ceil(filtered.length / limitNum) || 1,
        unreadCount,
        count: paginated.length,
        data: paginated
      };
    }
  }

  /**
   * Fast retrieval of unread notifications count
   */
  async getUnreadCount(userId = 'plant_operator_px') {
    try {
      const filter = { isRead: false };
      if (userId && userId !== 'ALL') {
        filter.$or = [{ userId }, { userId: 'plant_operator_px' }, { userId: 'ALL' }];
      }
      return await Notification.countDocuments(filter);
    } catch (dbErr) {
      return this.inMemoryNotifications.filter(n => !n.isRead).length;
    }
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId, userId = 'plant_operator_px') {
    try {
      const query = {
        $or: [
          { notificationId },
          ...(notificationId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: notificationId }] : [])
        ]
      };

      const notification = await Notification.findOneAndUpdate(
        query,
        { isRead: true, readAt: new Date() },
        { new: true }
      );

      if (!notification) {
        // Fallback check memory
        const inMem = this.inMemoryNotifications.find(n => n.notificationId === notificationId);
        if (inMem) {
          inMem.isRead = true;
          inMem.readAt = new Date();
          return inMem;
        }
        return null;
      }

      const unreadCount = await this.getUnreadCount(userId);
      this.broadcastToUser(userId, 'notification:read', { notificationId, isRead: true });
      this.broadcastToUser(userId, 'notification:count:update', { unreadCount });

      return notification;
    } catch (err) {
      console.error('[Notification Service Error] markAsRead failed:', err);
      throw err;
    }
  }

  /**
   * Mark all unread notifications as read for a given user
   */
  async markAllAsRead(userId = 'plant_operator_px') {
    try {
      const filter = { isRead: false };
      if (userId && userId !== 'ALL') {
        filter.$or = [{ userId }, { userId: 'plant_operator_px' }, { userId: 'ALL' }];
      }

      const result = await Notification.updateMany(filter, {
        isRead: true,
        readAt: new Date()
      });

      this.inMemoryNotifications.forEach(n => {
        n.isRead = true;
        n.readAt = new Date();
      });

      this.broadcastToUser(userId, 'notification:read_all', { success: true });
      this.broadcastToUser(userId, 'notification:count:update', { unreadCount: 0 });

      return {
        success: true,
        modifiedCount: result.modifiedCount || 0
      };
    } catch (err) {
      console.error('[Notification Service Error] markAllAsRead failed:', err);
      throw err;
    }
  }

  /**
   * Delete a single notification
   */
  async deleteNotification(notificationId, userId = 'plant_operator_px') {
    try {
      const query = {
        $or: [
          { notificationId },
          ...(notificationId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: notificationId }] : [])
        ]
      };

      const deleted = await Notification.findOneAndDelete(query);
      this.inMemoryNotifications = this.inMemoryNotifications.filter(
        n => n.notificationId !== notificationId
      );

      const unreadCount = await this.getUnreadCount(userId);
      this.broadcastToUser(userId, 'notification:count:update', { unreadCount });

      return Boolean(deleted);
    } catch (err) {
      console.error('[Notification Service Error] deleteNotification failed:', err);
      throw err;
    }
  }

  /**
   * Delete all read notifications for a given user
   */
  async deleteAllReadNotifications(userId = 'plant_operator_px') {
    try {
      const filter = { isRead: true };
      if (userId && userId !== 'ALL') {
        filter.$or = [{ userId }, { userId: 'plant_operator_px' }, { userId: 'ALL' }];
      }

      const result = await Notification.deleteMany(filter);
      this.inMemoryNotifications = this.inMemoryNotifications.filter(n => !n.isRead);

      return {
        success: true,
        deletedCount: result.deletedCount || 0
      };
    } catch (err) {
      console.error('[Notification Service Error] deleteAllReadNotifications failed:', err);
      throw err;
    }
  }

  /**
   * High-level Event Dispatcher:
   * Maps business events to standardized notification properties with deduplication logic
   */
  async dispatchEvent(eventType, payload) {
    let title = '';
    let message = '';
    let severity = 'INFO';
    let category = 'SYSTEM';
    let actionUrl = null;
    let dedupKey = null;
    let cooldownMinutes = 0;
    const userId = payload.userId || 'plant_operator_px';
    const machineId = payload.machineId ? payload.machineId.toUpperCase() : null;
    const workOrderId = payload.workOrderId ? payload.workOrderId.toUpperCase() : null;

    switch (eventType) {
      // 1. Machine Health & ML Prediction Events
      case 'MACHINE_RISK_CRITICAL': {
        const prob = payload.riskProbability ? (payload.riskProbability * 100).toFixed(0) : '90+';
        const failureMode = payload.suspectedFailureMode || 'Critical Mechanical Distress';
        title = `CRITICAL RISK: ${machineId}`;
        message = `Failure probability reached ${prob}%. Failure mode: ${failureMode}. Immediate maintenance required.`;
        severity = 'CRITICAL';
        category = 'MACHINE_HEALTH';
        actionUrl = `/machines/${machineId}`;
        dedupKey = `CRITICAL_${machineId}`;
        cooldownMinutes = 20; // 20m cooldown to avoid identical spam
        break;
      }

      case 'MACHINE_RISK_HIGH': {
        const prob = payload.riskProbability ? (payload.riskProbability * 100).toFixed(0) : '75+';
        const action = payload.recommendedAction || 'Inspect mechanical assemblies';
        title = `High Failure Risk: ${machineId}`;
        message = `Risk level escalated to HIGH (${prob}%). Action: ${action}.`;
        severity = 'WARNING';
        category = 'MACHINE_HEALTH';
        actionUrl = `/machines/${machineId}`;
        dedupKey = `HIGH_${machineId}`;
        cooldownMinutes = 30;
        break;
      }

      case 'MACHINE_RUL_CRITICAL': {
        const rul = payload.estimatedRULDays ?? payload.rulCycles ?? 5;
        title = `Imminent RUL Expiration: ${machineId}`;
        message = `Estimated Remaining Useful Life dropped to critical threshold (${rul} days/cycles).`;
        severity = 'CRITICAL';
        category = 'MACHINE_HEALTH';
        actionUrl = `/machines/${machineId}`;
        dedupKey = `RUL_CRIT_${machineId}`;
        cooldownMinutes = 60;
        break;
      }

      case 'MACHINE_RUL_WARNING': {
        const rul = payload.estimatedRULDays ?? payload.rulCycles ?? 20;
        title = `RUL Warning: ${machineId}`;
        message = `Remaining Useful Life warning threshold reached (${rul} days/cycles). Schedule overhaul window.`;
        severity = 'WARNING';
        category = 'MACHINE_HEALTH';
        actionUrl = `/machines/${machineId}`;
        dedupKey = `RUL_WARN_${machineId}`;
        cooldownMinutes = 60;
        break;
      }

      case 'SENSOR_ANOMALY': {
        const param = payload.parameter || 'Vibration';
        const val = payload.value || 'Exceeded';
        const limit = payload.limit || 'Standard limit';
        title = `Sensor Anomaly: ${machineId}`;
        message = `${param} anomaly detected (${val} vs limit ${limit}). Possible transducer or bearing failure.`;
        severity = 'WARNING';
        category = 'MACHINE_HEALTH';
        actionUrl = `/machines/${machineId}`;
        dedupKey = `SENSOR_${param}_${machineId}`;
        cooldownMinutes = 30;
        break;
      }

      // 2. Work Order Events
      case 'WORK_ORDER_CREATED': {
        const priority = (payload.priority || 'medium').toUpperCase();
        title = `Work Order Created: ${workOrderId}`;
        message = `New ${priority} priority work order created for ${machineId}: "${payload.title || 'Maintenance task'}".`;
        severity = priority === 'URGENT' || priority === 'CRITICAL' ? 'CRITICAL' : 'INFO';
        category = 'WORK_ORDER';
        actionUrl = `/work-orders`;
        dedupKey = `WO_CREATED_${workOrderId}`;
        cooldownMinutes = 0; // Distinct action, no cooldown
        break;
      }

      case 'WORK_ORDER_ASSIGNED': {
        const tech = payload.assignedTo || 'Technician';
        title = `Work Order Assigned: ${workOrderId}`;
        message = `Work order for ${machineId} assigned to ${tech}. Scheduled for ${payload.scheduledDate || 'upcoming shift'}.`;
        severity = 'INFO';
        category = 'WORK_ORDER';
        actionUrl = `/work-orders`;
        dedupKey = `WO_ASSIGN_${workOrderId}_${tech}`;
        cooldownMinutes = 5;
        break;
      }

      case 'WORK_ORDER_IN_PROGRESS': {
        title = `Work Order Started: ${workOrderId}`;
        message = `Maintenance technician has begun work on ${machineId}. Machine status updated.`;
        severity = 'INFO';
        category = 'MAINTENANCE';
        actionUrl = `/work-orders`;
        dedupKey = `WO_PROGRESS_${workOrderId}`;
        cooldownMinutes = 0;
        break;
      }

      case 'WORK_ORDER_COMPLETED': {
        title = `Maintenance Completed: ${workOrderId}`;
        message = `Work order ${workOrderId} for ${machineId} marked completed. Resolution notes filed and ready for audit.`;
        severity = 'SUCCESS';
        category = 'MAINTENANCE';
        actionUrl = `/work-audits`;
        dedupKey = `WO_DONE_${workOrderId}`;
        cooldownMinutes = 0;
        break;
      }

      case 'WORK_ORDER_CANCELLED': {
        title = `Work Order Cancelled: ${workOrderId}`;
        message = `Work order ${workOrderId} for ${machineId} was cancelled.`;
        severity = 'WARNING';
        category = 'WORK_ORDER';
        actionUrl = `/work-orders`;
        dedupKey = `WO_CANCEL_${workOrderId}`;
        cooldownMinutes = 0;
        break;
      }

      case 'WORK_ORDER_PRIORITY_CHANGED': {
        const newPri = (payload.newPriority || 'high').toUpperCase();
        title = `Work Order Escalation: ${workOrderId}`;
        message = `Priority for ${machineId} escalated to ${newPri}. Dispatch schedule updated.`;
        severity = newPri === 'URGENT' || newPri === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
        category = 'WORK_ORDER';
        actionUrl = `/work-orders`;
        dedupKey = `WO_PRI_${workOrderId}_${newPri}`;
        cooldownMinutes = 5;
        break;
      }

      // 3. Human Review Events
      case 'REVIEW_REQUESTED': {
        title = `Human Review Required: ${machineId}`;
        message = `New prediction ${payload.predictionId || ''} for ${machineId} is flagged for human engineer verification.`;
        severity = 'WARNING';
        category = 'HUMAN_REVIEW';
        actionUrl = `/reviews`;
        dedupKey = `REV_REQ_${payload.predictionId || machineId}`;
        cooldownMinutes = 15;
        break;
      }

      case 'REVIEW_APPROVED': {
        const rev = payload.reviewedBy || 'Engineer';
        title = `Priority Confirmed: ${machineId}`;
        message = `${rev} verified and confirmed ML baseline priority (${payload.priority || 'HIGH'}) for ${machineId}.`;
        severity = 'SUCCESS';
        category = 'HUMAN_REVIEW';
        actionUrl = `/reviews`;
        dedupKey = `REV_CONF_${payload.predictionId || machineId}`;
        cooldownMinutes = 0;
        break;
      }

      case 'REVIEW_OVERRIDDEN': {
        const rev = payload.reviewedBy || 'Lead Engineer';
        title = `Priority Overridden: ${machineId}`;
        message = `${rev} adjusted priority from ${payload.previousPriority} to ${payload.newPriority} for ${machineId}. Reason: "${payload.reason}".`;
        severity = 'WARNING';
        category = 'HUMAN_REVIEW';
        actionUrl = `/reviews`;
        dedupKey = `REV_OVER_${payload.predictionId || machineId}`;
        cooldownMinutes = 0;
        break;
      }

      // 4. Machine Fleet Events
      case 'MACHINE_REGISTERED': {
        title = `New Asset Registered: ${machineId}`;
        message = `Asset ${payload.name || machineId} (${payload.machineType || 'Machinery'}) registered at ${payload.location || 'Facility'}.`;
        severity = 'INFO';
        category = 'MACHINE_HEALTH';
        actionUrl = `/machines/${machineId}`;
        dedupKey = `MCH_NEW_${machineId}`;
        cooldownMinutes = 0;
        break;
      }

      case 'MACHINE_STATUS_CHANGED': {
        const newStatus = (payload.newStatus || 'operational').toUpperCase();
        title = `Asset Status: ${machineId} -> ${newStatus}`;
        message = `Operational status of ${machineId} changed from ${payload.oldStatus || 'unknown'} to ${newStatus}.`;
        severity = newStatus === 'OPERATIONAL' ? 'SUCCESS' : (newStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING');
        category = 'MACHINE_HEALTH';
        actionUrl = `/machines/${machineId}`;
        dedupKey = `MCH_STATUS_${machineId}_${newStatus}`;
        cooldownMinutes = 10;
        break;
      }

      // 5. System Events
      case 'SYSTEM_ERROR':
      default: {
        title = payload.title || 'System Notification';
        message = payload.message || 'PredictX operational event logged.';
        severity = payload.severity || 'INFO';
        category = payload.category || 'SYSTEM';
        actionUrl = payload.actionUrl || null;
        dedupKey = payload.dedupKey || null;
        cooldownMinutes = payload.cooldownMinutes || 10;
        break;
      }
    }

    return await this.createNotification({
      userId,
      title,
      message,
      eventType,
      category,
      severity,
      machineId,
      workOrderId,
      relatedEntityType: payload.relatedEntityType,
      relatedEntityId: payload.relatedEntityId,
      actionUrl,
      dedupKey,
      cooldownMinutes,
      metadata: payload.metadata || {}
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
