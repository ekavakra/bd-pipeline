/**
 * Agent Planner Service — LLM-Powered Decision Making
 *
 * Uses Ollama (via LangChain ChatOllama) to make autonomous decisions
 * about what action an agent should take next given the current context.
 *
 * This is the "brain" of the agent system — it receives context and
 * available actions, then returns a structured decision with reasoning.
 */

import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

// ── Types ────────────────────────────────────

export interface PlannerDecision {
  action: string;
  reasoning: string;
  params: Record<string, unknown>;
  confidence: number;
}

// ── Lazy-loaded LLM ──────────────────────────

let chatModel: unknown = null;

async function getModel() {
  if (chatModel) return chatModel;

  try {
    const { ChatOllama } = await import('@langchain/community/chat_models/ollama');
    chatModel = new ChatOllama({
      model: env.OLLAMA_MODEL ?? 'llama3.1:8b',
      baseUrl: env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      temperature: 0.3,
    });
    return chatModel;
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize ChatOllama — agent planner unavailable');
    return null;
  }
}

// ── Service ──────────────────────────────────

class AgentPlannerService {
  /**
   * Given context and available actions, decide what to do next.
   * Returns a structured decision with action, reasoning, and params.
   */
  async decide(context: string, availableActions: string[]): Promise<PlannerDecision> {
    const model = await getModel();

    if (!model) {
      return {
        action: 'noop',
        reasoning: 'LLM unavailable — cannot make decision',
        params: {},
        confidence: 0,
      };
    }

    try {
      const { ChatPromptTemplate } = await import('@langchain/core/prompts');

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are an autonomous business development agent for an LLP.
Your job is to analyze the current context and decide the best next action.

Available actions: {actions}

Respond ONLY with valid JSON:
{{
  "action": "action_name",
  "reasoning": "brief explanation of why this action",
  "params": {{}},
  "confidence": 0.0-1.0
}}

If no action is needed, return: {{ "action": "noop", "reasoning": "why", "params": {{}}, "confidence": 1.0 }}`,
        ],
        ['human', '{context}'],
      ]);

      const chain = prompt.pipe(model as never);
      const result = await chain.invoke({
        context,
        actions: availableActions.join(', '),
      });

      const content = typeof result === 'object' && result !== null && 'content' in result
        ? String((result as { content: unknown }).content)
        : String(result);

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn({ content }, 'Planner returned non-JSON response');
        return { action: 'noop', reasoning: 'Failed to parse decision', params: {}, confidence: 0 };
      }

      const decision = JSON.parse(jsonMatch[0]) as PlannerDecision;

      logger.debug({ action: decision.action, confidence: decision.confidence }, 'Agent planner decision');
      return decision;
    } catch (err) {
      logger.error({ err }, 'Agent planner decision failed');
      return { action: 'noop', reasoning: 'Decision error', params: {}, confidence: 0 };
    }
  }

  /**
   * Generate reasoning text for a given prompt (no structured output).
   */
  async generateReasoning(prompt: string): Promise<string> {
    const model = await getModel();
    if (!model) return 'LLM unavailable';

    try {
      const result = await (model as { invoke: (p: string) => Promise<{ content: string }> }).invoke(prompt);
      return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    } catch (err) {
      logger.error({ err }, 'Failed to generate reasoning');
      return 'Reasoning generation failed';
    }
  }
}

export const agentPlannerService = new AgentPlannerService();
