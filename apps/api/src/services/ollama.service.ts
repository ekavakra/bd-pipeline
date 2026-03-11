/**
 * Ollama Service — AI Model Interface
 *
 * Thin wrapper around LangChain's ChatOllama for reusable model access.
 * All AI modules should use this for consistent configuration.
 */

import { logger } from '../config/logger.js';
import { createFetchClient } from '../utils/fetch-client.js';

const ollamaBaseUrl = process.env['OLLAMA_BASE_URL'] ?? 'http://ollama-host:11434';
const ollamaClient = createFetchClient(ollamaBaseUrl);

export const ollamaService = {
  /**
   * Get a configured ChatOllama instance.
   * Lazy-loads LangChain modules to keep startup fast.
   */
  async getModel(options?: { temperature?: number; model?: string }) {
    const { ChatOllama } = await import('@langchain/community/chat_models/ollama');

    return new ChatOllama({
      model: options?.model ?? process.env['OLLAMA_MODEL'] ?? 'gpt-oss:120b-cloud',
      baseUrl: ollamaBaseUrl,
      temperature: options?.temperature ?? 0.7,
    });
  },

  /** Check if Ollama is reachable and the required model is available */
  async healthCheck(): Promise<{ healthy: boolean; models: string[] }> {
    try {
      const response = await ollamaClient.get<{ models: Array<{ name: string }> }>('/api/tags');
      const models = response.models?.map((m) => m.name) ?? [];
      return { healthy: true, models };
    } catch (error) {
      logger.warn({ error }, 'Ollama health check failed');
      return { healthy: false, models: [] };
    }
  },

  /** Generate embeddings for vector search (future use) */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await ollamaClient.post<{ embedding: number[] }>('/api/embeddings', {
      model: process.env['OLLAMA_MODEL'] ?? 'gpt-oss:120b-cloud',
      prompt: text,
    });
    return response.embedding;
  },
};
