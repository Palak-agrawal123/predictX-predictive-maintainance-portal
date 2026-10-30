import express from 'express';
import {
  chatWithRAG,
  retrieveKnowledge,
  checkRAGHealth,
  listDocuments,
  triggerIngestion
} from '../controllers/ragController.js';

const router = express.Router();

router.get('/health', checkRAGHealth);
router.post('/chat', chatWithRAG);
router.post('/retrieve', retrieveKnowledge);
router.get('/documents', listDocuments);
router.post('/ingest', triggerIngestion);

export default router;
