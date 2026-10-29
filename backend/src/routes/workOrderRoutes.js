import { Router } from 'express';
import {
  createWorkOrder,
  getAllWorkOrders,
  getWorkOrderById,
  updateWorkOrder,
  updateWorkOrderStatus
} from '../controllers/workOrderController.js';
import {
  validateCreateWorkOrder,
  validateUpdateWorkOrder,
  validateUpdateWorkOrderStatus
} from '../validators/workOrderValidator.js';

const router = Router();

router.get('/', getAllWorkOrders);
router.post('/', validateCreateWorkOrder, createWorkOrder);
router.get('/:id', getWorkOrderById);
router.patch('/:id', validateUpdateWorkOrder, updateWorkOrder);
router.patch('/:id/status', validateUpdateWorkOrderStatus, updateWorkOrderStatus);

export default router;
