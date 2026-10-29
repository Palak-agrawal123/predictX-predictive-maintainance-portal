import { Router } from 'express';
import { runPrediction, getAllPredictions } from '../controllers/predictionController.js';
import { validatePredictPayload } from '../validators/predictionValidator.js';

const router = Router();

router.post('/', validatePredictPayload, runPrediction);
router.get('/', getAllPredictions);

export default router;
