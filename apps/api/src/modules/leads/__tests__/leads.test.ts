/**
 * Leads Module – Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { leadsService } from '../leads.service.js';

// Mock Prisma
vi.mock('../../../config/db.js', () => ({
  prisma: {
    lead: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    leadSearchJob: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock BullMQ queues
vi.mock('../../../config/queue.js', () => ({
  leadSearchQueue: { add: vi.fn() },
  aiScoringQueue: { addBulk: vi.fn() },
}));

import { prisma } from '../../../config/db.js';
import { leadSearchQueue, aiScoringQueue } from '../../../config/queue.js';

describe('Leads Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should return paginated leads', async () => {
      const mockLeads = [
        { id: '1', companyName: 'Acme Inc', status: 'DISCOVERED' },
      ];
      vi.mocked(prisma.lead.findMany).mockResolvedValue(mockLeads as never);
      vi.mocked(prisma.lead.count).mockResolvedValue(1);

      const result = await leadsService.list({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.leads).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(prisma.lead.findMany).toHaveBeenCalled();
    });

    it('should apply search filter', async () => {
      vi.mocked(prisma.lead.findMany).mockResolvedValue([]);
      vi.mocked(prisma.lead.count).mockResolvedValue(0);

      await leadsService.list({
        page: 1,
        limit: 10,
        search: 'Acme',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const callArgs = vi.mocked(prisma.lead.findMany).mock.calls[0]?.[0];
      expect((callArgs as Record<string, unknown>)?.['where']).toHaveProperty('OR');
    });
  });

  describe('getById', () => {
    it('should return lead when found', async () => {
      const mockLead = { id: '1', companyName: 'Acme Inc' };
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockLead as never);

      const result = await leadsService.getById('1');
      expect(result.companyName).toBe('Acme Inc');
    });

    it('should throw NotFoundError when lead not found', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(null);

      await expect(leadsService.getById('nonexistent')).rejects.toThrow('Lead not found');
    });
  });

  describe('triggerSearch', () => {
    it('should create a job and enqueue it', async () => {
      vi.mocked(prisma.leadSearchJob.create).mockResolvedValue({
        id: 'job-1',
        status: 'QUEUED',
      } as never);

      const result = await leadsService.triggerSearch('user-1', { titles: ['CTO'] });

      expect(result.jobId).toBe('job-1');
      expect(result.status).toBe('QUEUED');
      expect(leadSearchQueue.add).toHaveBeenCalledWith(
        'lead-search',
        expect.objectContaining({ jobId: 'job-1' }),
      );
    });
  });

  describe('scoreBatch', () => {
    it('should queue scoring for unscored leads', async () => {
      vi.mocked(prisma.lead.findMany).mockResolvedValue([
        { id: 'lead-1' },
        { id: 'lead-2' },
      ] as never);

      const result = await leadsService.scoreBatch();

      expect(result.count).toBe(2);
      expect(aiScoringQueue.addBulk).toHaveBeenCalled();
    });

    it('should throw when no leads to score', async () => {
      vi.mocked(prisma.lead.findMany).mockResolvedValue([]);

      await expect(leadsService.scoreBatch()).rejects.toThrow('No leads found to score');
    });
  });
});
