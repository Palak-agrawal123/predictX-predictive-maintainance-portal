import { notificationService } from '../services/notificationService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * GET /api/notifications
 * Retrieve paginated notifications with filters
 */
export async function getNotifications(req, res, next) {
  try {
    const {
      isRead,
      category,
      severity,
      eventType,
      machineId,
      page = 1,
      limit = 20,
      userId = req.headers['x-user-id'] || 'plant_operator_px'
    } = req.query;

    const result = await notificationService.getNotifications({
      userId,
      isRead,
      category,
      severity,
      eventType,
      machineId,
      page,
      limit
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/notifications/unread-count
 * Fast endpoint for badge counter in navbar
 */
export async function getUnreadCount(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId || 'plant_operator_px';
    const unreadCount = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      unreadCount
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/notifications/stream
 * Real-time Server-Sent Events (SSE) feed
 */
export async function notificationStream(req, res, next) {
  try {
    const userId = req.query.userId || req.headers['x-user-id'] || 'plant_operator_px';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Register active SSE client
    notificationService.registerSSEClient(userId, res);

    // Initial greeting & current count
    const unreadCount = await notificationService.getUnreadCount(userId);
    res.write(`event: connected\ndata: ${JSON.stringify({ userId, unreadCount, timestamp: new Date() })}\n\n`);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || req.body?.userId || 'plant_operator_px';

    const updated = await notificationService.markAsRead(id, userId);
    if (!updated) {
      return next(new AppError(`Notification not found with ID: ${id}`, 404));
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/notifications/read-all
 * Mark all unread notifications as read
 */
export async function markAllAsRead(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || req.body?.userId || 'plant_operator_px';

    const result = await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read',
      ...result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/notifications/:id
 * Delete single notification
 */
export async function deleteNotification(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || 'plant_operator_px';

    const deleted = await notificationService.deleteNotification(id, userId);
    if (!deleted) {
      return next(new AppError(`Notification not found with ID: ${id}`, 404));
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/notifications/read
 * Delete all read notifications
 */
export async function deleteAllReadNotifications(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || 'plant_operator_px';

    const result = await notificationService.deleteAllReadNotifications(userId);

    res.json({
      success: true,
      message: 'All read notifications cleared',
      ...result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/notifications/trigger-event
 * Test trigger endpoint to generate actual event notifications
 */
export async function triggerEventNotification(req, res, next) {
  try {
    const { eventType, payload } = req.body;
    if (!eventType) {
      return next(new AppError('eventType is required in body', 400));
    }

    const result = await notificationService.dispatchEvent(eventType, payload || {});

    res.status(result.created ? 201 : 200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
}
