/**
 * Calls Service — Business Logic
 *
 * Discovery calls, transcription via FastAPI sidecar, meeting management, and notes.
 */

import { prisma } from '../../config/db.js';
import { transcriptionQueue } from '../../config/queue.js';
import { logger } from '../../config/logger.js';
import { NotFoundError, BadRequestError } from '../../utils/api-error.js';
import { paginate, buildPaginationMeta } from '../../utils/pagination.js';
import { createFetchClient } from '../../utils/fetch-client.js';

const transcriptionClient = createFetchClient(
  process.env['TRANSCRIPTION_URL'] ?? 'http://transcription:5001',
);

export const callsService = {
  /** Create a new discovery call record */
  async createCall(data: {
    leadId: string;
    conductedById: string;
    scheduledAt: string;
    recordingUrl?: string;
    notes?: string;
  }) {
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) throw new NotFoundError('Lead');

    return prisma.discoveryCall.create({
      data: {
        leadId: data.leadId,
        conductedById: data.conductedById,
        scheduledAt: new Date(data.scheduledAt),
        recordingUrl: data.recordingUrl,
        notes: data.notes,
      },
    });
  },

  /** Get a single call with lead info */
  async getCall(id: string) {
    const call = await prisma.discoveryCall.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, companyName: true, contactName: true } },
        conductedBy: { select: { id: true, name: true } },
      },
    });
    if (!call) throw new NotFoundError('Discovery call');
    return call;
  },

  /**
   * Trigger async transcription of a call recording via FastAPI sidecar.
   */
  async triggerTranscription(callId: string) {
    const call = await prisma.discoveryCall.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundError('Discovery call');
    if (!call.recordingUrl) throw new BadRequestError('No recording URL for this call');

    // Queue transcription job
    await transcriptionQueue.add('transcribe-call', {
      callId: call.id,
      recordingUrl: call.recordingUrl,
    });

    await prisma.discoveryCall.update({
      where: { id: callId },
      data: { transcriptStatus: 'PROCESSING' },
    });

    logger.info({ callId }, 'Transcription job queued');
    return { message: 'Transcription queued', callId };
  },

  /** Get AI-generated call summary */
  async getCallSummary(callId: string) {
    const call = await prisma.discoveryCall.findUnique({
      where: { id: callId },
      select: {
        id: true,
        transcript: true,
        transcriptStatus: true,
      },
    });
    if (!call) throw new NotFoundError('Discovery call');

    if (!call.transcript) {
      throw new BadRequestError('Call has not been transcribed yet');
    }

    return call;
  },

  /** List meetings with pagination */
  async listMeetings(query: {
    page: number;
    limit: number;
    clientId?: string;
    upcoming?: boolean;
    sortBy: string;
    sortOrder: string;
  }) {
    const where: Record<string, unknown> = {};
    if (query.clientId) where['clientId'] = query.clientId;
    if (query.upcoming) where['scheduledAt'] = { gte: new Date() };

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        ...paginate(query.page, query.limit),
        orderBy: { [query.sortBy]: query.sortOrder },
        include: {
          client: { select: { id: true, companyName: true } },
        },
      }),
      prisma.meeting.count({ where }),
    ]);

    return { meetings, meta: buildPaginationMeta(total, query.page, query.limit) };
  },

  /** Create a meeting for a client */
  async createMeeting(data: {
    clientId: string;
    title: string;
    description?: string;
    scheduledAt: string;
    type: string;
    createdById: string;
  }) {
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) throw new NotFoundError('Client');

    return prisma.meeting.create({
      data: {
        clientId: data.clientId,
        title: data.title,
        scheduledAt: new Date(data.scheduledAt),
        type: data.type,
        organizedById: data.createdById,
        status: 'UPCOMING',
      },
    });
  },

  /** Get a single meeting */
  async getMeeting(id: string) {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, companyName: true } },
        notes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!meeting) throw new NotFoundError('Meeting');
    return meeting;
  },

  /** Update a meeting */
  async updateMeeting(id: string, data: Record<string, unknown>) {
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundError('Meeting');
    return prisma.meeting.update({ where: { id }, data: data as never });
  },

  /** Add a note to a meeting */
  async addMeetingNote(meetingId: string, userId: string, content: string) {
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundError('Meeting');

    return prisma.meetingNote.create({
      data: {
        meetingId,
        writtenById: userId,
        body: content,
      },
    });
  },

  /** Get all notes for a meeting */
  async getMeetingNotes(meetingId: string) {
    return prisma.meetingNote.findMany({
      where: { meetingId },
      include: { writtenBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },
};
