import { simulationService } from '../services/simulationService.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

export async function startSimulation(req, res, next) {
  try {
    const result = await simulationService.startSimulation(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function pauseSimulation(req, res, next) {
  try {
    const result = await simulationService.pauseSimulation();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function resumeSimulation(req, res, next) {
  try {
    const result = await simulationService.resumeSimulation();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function stopSimulation(req, res, next) {
  try {
    const result = await simulationService.stopSimulation();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function resetSimulation(req, res, next) {
  try {
    const result = await simulationService.resetSimulation();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSimulationStatus(req, res, next) {
  try {
    const result = await simulationService.getStatus();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSimulationTelemetry(req, res, next) {
  try {
    const { machine_id, limit } = req.query;
    const result = await simulationService.getTelemetry(machine_id, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function switchFleet(req, res, next) {
  try {
    const { fleet } = req.body;
    const result = await simulationService.switchFleet(fleet || 'industrial');
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function ingestTelemetry(req, res, next) {
  try {
    const result = await simulationService.ingestTelemetry(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listDatasets(req, res, next) {
  try {
    const result = await simulationService.listDatasets();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getDataset(req, res, next) {
  try {
    const { datasetId } = req.params;
    const result = await simulationService.getDataset(datasetId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function previewDataset(req, res, next) {
  try {
    const { datasetId } = req.params;
    const limit = req.query.limit || 15;
    const result = await simulationService.previewDataset(datasetId, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function configureDataset(req, res, next) {
  try {
    const { datasetId } = req.params;
    const result = await simulationService.configureDataset(datasetId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function uploadDataset(req, res, next) {
  try {
    const mlUrl = `${env.ML_SERVICE_URL || 'http://127.0.0.1:8000'}/api/simulation/datasets/upload`;
    const response = await fetch(mlUrl, {
      method: 'POST',
      headers: {
        'content-type': req.headers['content-type']
      },
      body: req,
      duplex: 'half'
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    next(err);
  }
}

export async function syncSimulationPrediction(req, res, next) {
  try {
    const result = await simulationService.syncSimulationPrediction(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/simulation/stream
 * Proxies the real-time SSE stream from the Python ML service (:8000)
 */
export async function streamSimulation(req, res, next) {
  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();

    // Development logging for Phase 8
    console.log('[SSE Proxy] New frontend client connected to SSE telemetry stream.');

    const mlUrl = `${env.ML_SERVICE_URL || 'http://127.0.0.1:8000'}/api/simulation/stream`;
    
    try {
      const response = await fetch(mlUrl, {
        headers: { 'Accept': 'text/event-stream' }
      });

      if (!response.ok || !response.body) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: `ML Service error: ${response.status}` })}\n\n`);
        return res.end();
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      req.on('close', () => {
        console.log('[SSE Proxy] Frontend client disconnected.');
        try { reader.cancel(); } catch (_) {}
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
        if (typeof res.flush === 'function') {
          res.flush();
        }
      }
      res.end();
    } catch (fetchErr) {
      console.warn(`[SSE Proxy] Direct ML stream at ${mlUrl} unreachable (${fetchErr.message}). Emitting offline notification.`);
      res.write(`event: offline\ndata: ${JSON.stringify({ status: 'ml_offline', message: fetchErr.message })}\n\n`);
      res.end();
    }
  } catch (err) {
    next(err);
  }
}
