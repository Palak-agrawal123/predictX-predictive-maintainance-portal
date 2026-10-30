import { Router } from 'express';
import { getMachinePriorities } from '../controllers/priorityController.js';

const router = Router();

router.get('/', getMachinePriorities);

export default router;
