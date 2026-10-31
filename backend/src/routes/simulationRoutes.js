import { Router } from 'express';
import {
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  stopSimulation,
  resetSimulation,
  getSimulationStatus,
  getSimulationTelemetry,
  ingestTelemetry,
  syncSimulationPrediction,
  streamSimulation,
  switchFleet,
  listDatasets,
  getDataset,
  previewDataset,
  configureDataset,
  uploadDataset
} from '../controllers/simulationController.js';

const router = Router();

// Streaming & Execution routes
router.get('/stream', streamSimulation);
router.post('/start', startSimulation);
router.post('/pause', pauseSimulation);
router.post('/resume', resumeSimulation);
router.post('/stop', stopSimulation);
router.post('/reset', resetSimulation);
router.post('/switch-fleet', switchFleet);
router.get('/status', getSimulationStatus);
router.get('/telemetry', getSimulationTelemetry);
router.post('/ingest', ingestTelemetry);
router.post('/sync-prediction', syncSimulationPrediction);

// Dataset management & schema routes (Phases 2 & 3)
router.get('/datasets', listDatasets);
router.post('/datasets/upload', uploadDataset);
router.get('/datasets/:datasetId', getDataset);
router.get('/datasets/:datasetId/preview', previewDataset);
router.post('/datasets/:datasetId/configure', configureDataset);

export default router;
