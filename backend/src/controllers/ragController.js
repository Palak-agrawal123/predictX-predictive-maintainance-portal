import { ragService } from '../services/ragService.js';
import { Machine } from '../models/Machine.js';
import { Prediction } from '../models/Prediction.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * POST /api/rag/chat
 * Primary entry point for React AI Maintenance Assistant
 */
export async function chatWithRAG(req, res, next) {
  try {
    const { question, machineId, sensors, conversationId, topK } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return next(new AppError('Question field is required and cannot be empty', 400));
    }

    let enrichedSensors = sensors || req.body.telemetry || {};
    let targetMachineId = machineId || req.body.machine_id;

    // If machine ID is specified, enrich with stored MongoDB machine data
    if (targetMachineId) {
      try {
        const cleanId = String(targetMachineId).trim();
        const query = cleanId.match(/^[0-9a-fA-F]{24}$/)
          ? { $or: [{ _id: cleanId }, { machineId: cleanId.toUpperCase() }] }
          : { machineId: cleanId.toUpperCase() };
        const machine = await Machine.findOne(query).lean();
        if (machine) {
          enrichedSensors = {
            ...machine.operatingParameters,
            ...enrichedSensors
          };
          targetMachineId = machine.machineId;
        }
      } catch (dbErr) {
        console.warn('[RAG Controller Note] Could not enrich from DB:', dbErr.message);
      }
    }

    const ragResponse = await ragService.chat(
      question.trim(),
      targetMachineId,
      enrichedSensors,
      conversationId,
      topK || 4
    );

    res.json(ragResponse);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/rag/retrieve
 * Semantic knowledge search endpoint
 */
export async function retrieveKnowledge(req, res, next) {
  try {
    const { query, machineId, topK, filterMetadata } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return next(new AppError('Query field is required and cannot be empty', 400));
    }

    const retrievalResult = await ragService.retrieve(
      query.trim(),
      machineId,
      topK || 5,
      filterMetadata
    );

    res.json(retrievalResult);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rag/health
 * Check RAG microservice health
 */
export async function checkRAGHealth(req, res, next) {
  try {
    const health = await ragService.checkHealth();
    res.json({
      success: true,
      service: 'predictx-express-rag-gateway',
      ragService: health
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rag/documents
 * List all indexed knowledge documents
 */
export async function listDocuments(req, res, next) {
  try {
    const docs = await ragService.listDocuments();
    res.json(docs);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/rag/ingest
 * Trigger manual re-indexing of documents
 */
export async function triggerIngestion(req, res, next) {
  try {
    const forceReindex = req.query.force_reindex === 'true';
    const report = await ragService.triggerIngest(forceReindex);
    res.json(report);
  } catch (err) {
    next(err);
  }
}
