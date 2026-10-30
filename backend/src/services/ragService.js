import { env } from '../config/env.js';

export class RAGService {
  constructor() {
    this.baseUrl = env.RAG_SERVICE_URL.replace(/\/$/, '');
    this.timeoutMs = env.RAG_SERVICE_TIMEOUT_MS;
  }

  async checkHealth() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        return await response.json();
      }
      return { status: 'degraded', statusCode: response.status };
    } catch (err) {
      clearTimeout(timeout);
      return { status: 'offline', error: err.message };
    }
  }

  async chat(question, machineId = null, sensors = {}, conversationId = null, topK = 4) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const payload = {
        question,
        machine_id: machineId,
        sensors,
        conversation_id: conversationId,
        top_k: topK
      };

      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`RAG Microservice error HTTP ${response.status}: ${errorBody}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  async retrieve(query, machineId = null, topK = 5, filterMetadata = null) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const payload = {
        query,
        machine_id: machineId,
        top_k: topK,
        filter_metadata: filterMetadata
      };

      const response = await fetch(`${this.baseUrl}/retrieve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`RAG Microservice error HTTP ${response.status}: ${errorBody}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  async listDocuments() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/documents`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeout);
      return await response.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  async triggerIngest(forceReindex = false) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.baseUrl}/ingest?force_reindex=${forceReindex}`, {
        method: 'POST',
        signal: controller.signal
      });
      clearTimeout(timeout);
      return await response.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export const ragService = new RAGService();
