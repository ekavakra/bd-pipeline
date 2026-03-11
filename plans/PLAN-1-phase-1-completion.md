# Plan 1: Phase 1 - Completion & Foundation

## Overview
Phase 1 is approximately 80% complete. This plan focuses on completing remaining work, testing, and building the AI Agent foundation.

## Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| Lead CRUD | ✅ Complete | All routes implemented |
| Lead Search | ✅ Complete | SearXNG + web scraping + LLM extraction |
| AI Scoring | ✅ Complete | LangChain + Ollama |
| Human Review | ✅ Complete | Queue + bulk review |
| Pitch Generation | ✅ Complete | API implemented |
| Follow-up Sequences | ✅ Complete | BullMQ integration |
| Call Transcription | ✅ Complete | FastAPI sidecar integration |
| Proposal Generation | ✅ Complete | AI-generated proposals |
| Deal Close | ✅ Complete | Atomic transaction |

---

## Section 1.1: Testing & Bug Fixes

### Task 1.1.1: Leads Module Tests
**Files to create:**
- `apps/api/src/modules/leads/__tests__/leads.service.test.ts`
- `apps/api/src/modules/leads/__tests__/leads.controller.test.ts`

**Pattern to follow:** See `apps/api/src/modules/auth/__tests__/auth.test.ts`

### Task 1.1.2: Outreach Module Tests
**Files to create:**
- `apps/api/src/modules/outreach/__tests__/outreach.service.test.ts`

### Task 1.1.3: Proposals Module Tests
**Files to create:**
- `apps/api/src/modules/proposals/__tests__/proposals.service.test.ts`

---

## Section 1.2: API Documentation

### Task 1.2.1: Verify Swagger
**File:** `apps/api/src/config/swagger.ts`

**Check:** Access `http://localhost:3001/api/docs` - should show all endpoints

**If not working:** Ensure `@asteasolutions/zod-to-openapi` is wired in `apps/api/src/index.ts`

---

## Section 1.3: AI Agent Core Infrastructure

### Task 1.3.1: Event Bus Service
**File:** `apps/api/src/services/event-bus.service.ts`

**What:** Create Redis pub/sub based event system

**Pattern:**
```typescript
// Use existing Redis connection from apps/api/src/config/redis.ts
import { redis } from '../config/redis.js';

interface EventData {
  type: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

// Export events as constants
export const EVENTS = {
  LEAD_DISCOVERED: 'lead:discovered',
  LEAD_SCORED: 'lead:scored',
  LEAD_QUALIFIED: 'lead:qualified',
  DEAL_CLOSED: 'deal:closed',
  STAGE_ADVANCED: 'onboarding:stage-advanced',
  SLA_BREACH: 'onboarding:sla-breach',
  NPS_SUBMITTED: 'success:nps-submitted',
  CHURN_DETECTED: 'success:churn-detected',
} as const;
```

### Task 1.3.2: Agent Log Service
**File:** `apps/api/src/services/agent-log.service.ts`

**What:** Log all autonomous agent actions

**Pattern:**
```typescript
interface AgentLogEntry {
  id: string;
  agentType: 'lead' | 'onboarding' | 'success' | 'notify';
  action: string;
  targetType: string;
  targetId: string;
  status: 'success' | 'failed' | 'pending_approval';
  reasoning: string;
  details: Record<string, unknown>;
  createdAt: Date;
}
```

### Task 1.3.3: Add Agent Queues
**File:** `apps/api/src/config/queue.ts`

**Add:**
```typescript
export const agentTaskQueue = new Queue('agent-task', defaultOpts);
export const agentScheduleQueue = new Queue('agent-schedule', defaultOpts);
```

### Task 1.3.4: Lead Discovery Agent
**File:** `apps/api/src/agents/lead-discovery.agent.ts`

**What:** Autonomous lead discovery using existing services

**Dependencies:** 
- `apps/api/src/services/web-search.service.ts` (exists)
- `apps/api/src/services/scraper.service.ts` (exists)
- `apps/api/src/modules/leads/leads.service.ts` (exists)

**Pattern:**
```typescript
class LeadDiscoveryAgent {
  async runDiscoveryTask(filters: SearchFilters): Promise<Lead[]> {
    // 1. Expand queries using Ollama
    // 2. Search via SearXNG
    // 3. Scrape company data
    // 4. Extract and create leads
    // 5. Publish LEAD_DISCOVERED event
  }
}
```

### Task 1.3.5: Lead Scoring Agent
**File:** `apps/api/src/agents/lead-scoring.agent.ts`

**Dependencies:**
- `apps/api/src/jobs/processors.ts` (exists - `processAiScoring`)

### Task 1.3.6: Follow-up Agent
**File:** `apps/api/src/agents/followup.agent.ts`

**Dependencies:**
- `apps/api/src/modules/outreach/outreach.service.ts` (exists)

---

## File Summary

### New Files to Create

```
apps/api/src/
├── agents/
│   ├── lead-discovery.agent.ts
│   ├── lead-scoring.agent.ts
│   └── followup.agent.ts
├── services/
│   ├── event-bus.service.ts
│   └── agent-log.service.ts
```

### Files to Modify

```
apps/api/src/config/queue.ts
apps/api/src/index.ts
apps/api/src/jobs/processors.ts
```

---

## Priority Order

1. Task 1.3.1 - Event Bus Service
2. Task 1.3.2 - Agent Log Service  
3. Task 1.3.3 - Add Agent Queues
4. Task 1.1.x - Testing (can parallel)
5. Task 1.3.4-6 - Agents (depends on 1.3.1-3)
