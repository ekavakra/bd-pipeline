/**
 * Transcription Service Client
 *
 * Communicates with the FastAPI transcription sidecar for
 * audio-to-text and AI summarization of discovery calls.
 */

import { logger } from '../config/logger.js';
import { createFetchClient } from '../utils/fetch-client.js';

const transcriptionClient = createFetchClient(
  process.env['TRANSCRIPTION_URL'] ?? 'http://transcription:5001',
);

interface TranscriptionResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  language: string;
  duration: number;
}

export const transcriptionService = {
  /**
   * Submit an audio file URL for transcription.
   */
  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    logger.info({ audioUrl }, 'Submitting transcription request');

    const result = await transcriptionClient.post<TranscriptionResult>('/transcribe', {
      audio_url: audioUrl,
    });

    logger.info(
      { duration: result.duration, language: result.language },
      'Transcription completed',
    );

    return result;
  },

  /**
   * Generate an AI summary of transcribed text.
   */
  async summarize(text: string): Promise<{ summary: string; keyInsights: string[] }> {
    const result = await transcriptionClient.post<{
      summary: string;
      key_insights: string[];
    }>('/summarize', { text });

    return {
      summary: result.summary,
      keyInsights: result.key_insights,
    };
  },

  /** Check if the transcription sidecar is healthy */
  async healthCheck(): Promise<boolean> {
    try {
      await transcriptionClient.get('/health');
      return true;
    } catch {
      return false;
    }
  },
};
