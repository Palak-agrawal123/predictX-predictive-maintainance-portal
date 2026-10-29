import { Router } from 'express';
import { getModelMetrics } from '../controllers/dashboardController.js';

const router = Router();

router.get('/', getModelMetrics);

export default router;
