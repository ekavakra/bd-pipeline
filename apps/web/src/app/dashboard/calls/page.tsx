'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate, cn } from '@/lib/utils';
import {
  Phone,
  Calendar,
  Clock,
  Video,
  Plus,
  Search,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MessageSquare,
  X,
  Mic,
  Send,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────

interface Meeting {
  id: string;
  title: string;
  type: string;
  scheduledAt: string;
  durationMinutes: number;
  meetLink: string | null;
  status: string;
  clientId: string | null;
  leadId: string | null;
  client?: { companyName: string };
  lead?: { companyName: string };
  createdAt: string;
}

interface MeetingsResponse {
  meetings: Meeting[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface MeetingNote {
  id: string;
  body: string;
  writtenBy: { name: string };
  createdAt: string;
}

interface DiscoveryCall {
  id: string;
  leadId: string;
  lead?: { companyName: string; contactName: string | null };
  scheduledAt: string;
  durationMinutes: number | null;
  notes: string | null;
  recordingUrl: string | null;
  transcription: string | null;
  summary: string | null;
  createdAt: string;
}

interface LeadOption {
  id: string;
  companyName: string;
  contactName: string | null;
}

// ── Constants ────────────────────────────────

const MEETING_TYPE_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  DISCOVERY: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: Phone },
  KICKOFF: { color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: Video },
  REQUIREMENTS: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: FileText },
  REVIEW: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: CheckCircle2 },
  TRAINING: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: MessageSquare },
  OTHER: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Calendar },
};

const MEETING_STATUS_COLORS: Record<string, string> = {
  UPCOMING: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  RESCHEDULED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
};

// ── Components ───────────────────────────────

function CreateMeetingModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    type: 'DISCOVERY',
    scheduledAt: '',
    durationMinutes: 60,
    meetLink: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiClient.post('/meetings', {
        ...data,
        durationMinutes: Number(data.durationMinutes),
        meetLink: data.meetLink || undefined,
      }),
    onSuccess: () => {
      toast.success('Meeting scheduled');
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <ModalShell title="Schedule Meeting" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Discovery call with Acme"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            {Object.keys(MEETING_TYPE_CONFIG).map((type) => (
              <option key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date & Time</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Duration (min)</label>
            <input
              type="number"
              value={form.durationMinutes}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Meeting Link <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="url"
            value={form.meetLink}
            onChange={(e) => setForm((f) => ({ ...f, meetLink: e.target.value }))}
            placeholder="https://meet.google.com/..."
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">Cancel</button>
        <button
          onClick={() => form.title && form.scheduledAt && createMutation.mutate(form)}
          disabled={!form.title || !form.scheduledAt || createMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Schedule
        </button>
      </div>
    </ModalShell>
  );
}

/* ── Log Discovery Call Modal ─────────────── */

function LogCallModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ leadId: '', scheduledAt: '', durationMinutes: '30', notes: '' });

  const { data: leadsData } = useQuery({
    queryKey: ['leads-for-call'],
    queryFn: () => apiClient.get<{ leads: LeadOption[] }>('/leads?limit=100'),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post('/calls', {
        leadId: form.leadId,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMinutes: parseInt(form.durationMinutes) || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Discovery call logged');
      qc.invalidateQueries({ queryKey: ['meetings'] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to log call'),
  });

  return (
    <ModalShell title="Log Discovery Call" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Lead *</label>
          <select
            value={form.leadId}
            onChange={(e) => setForm((f) => ({ ...f, leadId: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="">Select a lead...</option>
            {leadsData?.leads?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.companyName} {l.contactName ? `— ${l.contactName}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Scheduled At *</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Duration (min)</label>
            <input
              type="number"
              value={form.durationMinutes}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Call notes, agenda items..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">Cancel</button>
        <button
          onClick={() => mutate()}
          disabled={!form.leadId || !form.scheduledAt || isPending}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
          Log Call
        </button>
      </div>
    </ModalShell>
  );
}

/* ── Meeting Detail Panel ──────────────────── */

function MeetingDetailPanel({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const qc = useQueryClient();
  const typeConfig = MEETING_TYPE_CONFIG[meeting.type] ?? MEETING_TYPE_CONFIG['OTHER']!;
  const TypeIcon = typeConfig!.icon;
  const [noteBody, setNoteBody] = useState('');

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ['meeting-notes', meeting.id],
    queryFn: () => apiClient.get<{ notes: MeetingNote[] }>(`/meetings/${meeting.id}/notes`),
  });

  const addNote = useMutation({
    mutationFn: () => apiClient.post(`/meetings/${meeting.id}/notes`, { body: noteBody }),
    onSuccess: () => {
      toast.success('Note added');
      setNoteBody('');
      qc.invalidateQueries({ queryKey: ['meeting-notes', meeting.id] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to add note'),
  });

  const transcribe = useMutation({
    mutationFn: () => apiClient.post(`/calls/${meeting.id}/transcribe`, {}),
    onSuccess: () => toast.success('Transcription started — check back in a moment'),
    onError: (e: any) => toast.error(e.message ?? 'Transcription failed'),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{meeting.title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', typeConfig.color)}>
              <TypeIcon className="h-3 w-3" /> {meeting.type}
            </span>
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', MEETING_STATUS_COLORS[meeting.status] ?? '')}>
              {meeting.status}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Date</span>
              <span className="font-medium text-slate-900 dark:text-white">{formatDate(meeting.scheduledAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Time</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {new Date(meeting.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Duration</span>
              <span className="font-medium text-slate-900 dark:text-white">{meeting.durationMinutes}m</span>
            </div>
            {meeting.client?.companyName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Client</span>
                <span className="font-medium text-slate-900 dark:text-white">{meeting.client.companyName}</span>
              </div>
            )}
            {meeting.lead?.companyName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Lead</span>
                <span className="font-medium text-slate-900 dark:text-white">{meeting.lead.companyName}</span>
              </div>
            )}
            {meeting.meetLink && (
              <div className="flex justify-between">
                <span className="text-slate-500">Link</span>
                <a href={meeting.meetLink} target="_blank" rel="noopener" className="flex items-center gap-1 text-brand-600 hover:underline">
                  Join <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* Transcription */}
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Transcription</span>
              <button
                onClick={() => transcribe.mutate()}
                disabled={transcribe.isPending}
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"
              >
                {transcribe.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
                Transcribe
              </button>
            </div>
            <p className="text-xs text-slate-400">Upload a recording or trigger AI transcription after the call.</p>
          </div>

          {/* Notes */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Notes</h3>
            <div className="space-y-2">
              {notesLoading ? (
                <p className="text-xs text-slate-400">Loading notes...</p>
              ) : (notesData?.notes?.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-400">No notes yet.</p>
              ) : (
                notesData?.notes?.map((note) => (
                  <div key={note.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{note.body}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {note.writtenBy.name} &middot; {formatDate(note.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note..."
                onKeyDown={(e) => e.key === 'Enter' && noteBody.trim() && addNote.mutate()}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                onClick={() => noteBody.trim() && addNote.mutate()}
                disabled={!noteBody.trim() || addNote.isPending}
                className="rounded-lg bg-brand-600 px-3 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {addNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Meeting Card ─────────────────────────── */

/* ── Meeting Card ─────────────────────────── */

function MeetingCard({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  const typeConfig = MEETING_TYPE_CONFIG[meeting.type] ?? MEETING_TYPE_CONFIG['OTHER']!;
  const TypeIcon = typeConfig!.icon;
  const statusColor = MEETING_STATUS_COLORS[meeting.status] ?? MEETING_STATUS_COLORS['UPCOMING'];
  const scheduledDate = new Date(meeting.scheduledAt);
  const companyName = meeting.client?.companyName ?? meeting.lead?.companyName ?? '';

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={cn('rounded-lg p-2', typeConfig.color)}>
            <TypeIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{meeting.title}</h3>
            {companyName && <p className="text-xs text-slate-500">{companyName}</p>}
          </div>
        </div>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', statusColor)}>
          {meeting.status}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(meeting.scheduledAt)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {meeting.durationMinutes}m
        </span>
      </div>

      {meeting.meetLink && (
        <a
          href={meeting.meetLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          <ExternalLink className="h-3 w-3" />
          Join Meeting
        </a>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────

export default function CallsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['meetings', { page, search }],
    queryFn: () =>
      apiClient.get<MeetingsResponse>(
        `/meetings?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const filteredMeetings = data?.meetings?.filter((m) => {
    if (filter === 'upcoming') return m.status === 'UPCOMING';
    if (filter === 'completed') return m.status === 'COMPLETED';
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Calls & Meetings</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data?.meta?.total ?? 0} total meetings
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLogCall(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <Phone className="h-4 w-4" /> Log Call
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Schedule Meeting
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search meetings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(['all', 'upcoming', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Meetings grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-white dark:bg-slate-900" />
          ))
        ) : (filteredMeetings?.length ?? 0) === 0 ? (
          <div className="col-span-full rounded-xl bg-white p-12 text-center dark:bg-slate-900">
            <Calendar className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">
              {filter === 'all'
                ? 'No meetings yet. Schedule one to get started.'
                : `No ${filter} meetings.`}
            </p>
          </div>
        ) : (
          filteredMeetings?.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} onClick={() => setSelectedMeeting(meeting)} />
          ))
        )}
      </div>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {data.meta.page} of {data.meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.meta.totalPages}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && <CreateMeetingModal onClose={() => setShowCreate(false)} />}
      {showLogCall && <LogCallModal onClose={() => setShowLogCall(false)} />}
      {selectedMeeting && <MeetingDetailPanel meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />}
    </div>
  );
}

/* ── Shared Modal Shell ───────────────────── */

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
