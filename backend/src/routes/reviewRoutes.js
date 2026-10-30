import { Router } from 'express';
import {
  getPendingReviews,
  getAllReviews,
  getReviewById,
  confirmPredictionPriority,
  overridePredictionPriority
} from '../controllers/reviewController.js';

const router = Router();

// GET /api/reviews/pending - List predictions awaiting human confirmation/override
router.get('/pending', getPendingReviews);

// GET /api/reviews - List all reviews with filtering
router.get('/', getAllReviews);

// GET /api/reviews/:id - Retrieve review detail by ID
router.get('/:id', getReviewById);

// POST /api/reviews/:id/confirm - Confirm suggested ML priority
router.post('/:id/confirm', confirmPredictionPriority);

// POST /api/reviews/:id/override - Override priority with mandatory reason
router.post('/:id/override', overridePredictionPriority);

export default router;
