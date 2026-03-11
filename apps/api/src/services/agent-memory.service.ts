/**
 * Agent Memory Service — In-Process Context Store
 *
 * Maintains per-agent context and conversation history in memory.
 * Used by agents to accumulate context across multiple actions
 * within a single task execution cycle.
 *
 * Note: This is ephemeral — lost on process restart. For persistent
 * context, agents should read from AgentLog + database.
 */

import { logger } from '../config/logger.js';

// ── Types ────────────────────────────────────

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// ── Implementation ───────────────────────────

class AgentMemory {
  private context: Map<string, unknown> = new Map();
  private conversationHistory: Message[] = [];
  private maxHistory: number = 50;

  /** Store a context value by key */
  addContext(key: string, value: unknown): void {
    this.context.set(key, value);
  }

  /** Retrieve a context value by key */
  getContext(key: string): unknown {
    return this.context.get(key);
  }

  /** Check if a context key exists */
  hasContext(key: string): boolean {
    return this.context.has(key);
  }

  /** Remove a specific context key */
  removeContext(key: string): void {
    this.context.delete(key);
  }

  /** Clear all context */
  clearContext(): void {
    this.context.clear();
    logger.debug('Agent memory context cleared');
  }

  /** Add a message to conversation history */
  addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date(),
    });

    // Trim if exceeding max history
    if (this.conversationHistory.length > this.maxHistory) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistory);
    }
  }

  /** Get conversation history (optionally limited) */
  getConversationHistory(limit?: number): Message[] {
    if (limit) {
      return this.conversationHistory.slice(-limit);
    }
    return [...this.conversationHistory];
  }

  /** Clear conversation history */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Build a context prompt string for LLM calls.
   * Combines stored context + conversation history into a single prompt.
   */
  buildContextPrompt(): string {
    const contextEntries = Array.from(this.context.entries())
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n');

    const historyText = this.conversationHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const parts: string[] = [];
    if (contextEntries) parts.push(`Context:\n${contextEntries}`);
    if (historyText) parts.push(`Conversation History:\n${historyText}`);

    return parts.join('\n\n');
  }

  /** Get current memory stats */
  getStats(): { contextKeys: number; historyLength: number } {
    return {
      contextKeys: this.context.size,
      historyLength: this.conversationHistory.length,
    };
  }
}

// Export a singleton instance
export const agentMemory = new AgentMemory();
