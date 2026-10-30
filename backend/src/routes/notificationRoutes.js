import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  notificationStream,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllReadNotifications,
  triggerEventNotification
} from '../controllers/notificationController.js';

const router = Router();

// Real-time SSE stream
router.get('/stream', notificationStream);

// Core collection endpoints
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.delete('/read', deleteAllReadNotifications);

// Test / Manual Event Trigger
router.post('/trigger-event', triggerEventNotification);

// Item specific endpoints
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
