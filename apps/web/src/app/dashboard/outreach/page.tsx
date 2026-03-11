'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate, cn } from '@/lib/utils';
import {
  Mail,
  Send,
  MessageSquare,
  CheckCircle2,
  Clock,
  Eye,
  XCircle,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────

interface Pitch {
  id: string;
  leadId: string;
  channel: string;
  subject: string | null;
  body: string;
  version: number;
  status: string;
  generatedByAi: boolean;
  sentAt: string | null;
  createdAt: string;
  lead?: { companyName: string; contactName: string | null; contactEmail: string | null };
}

interface FollowupSequence {
  id: string;
  leadId: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  nextSendAt: string | null;
  lead?: { companyName: string };
}

interface AnalyticsData {
  totalPitches: number;
  sentCount: number;
  approvedCount: number;
  draftCount: number;
  activeFollowups: number;
}

// ── Constants ────────────────────────────────

const PITCH_STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  DRAFT: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Clock },
  PENDING_REVIEW: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: Eye },
  APPROVED: { color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle2 },
  SENT: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: Send },
  REJECTED: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: XCircle },
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  EMAIL: Mail,
  LINKEDIN: MessageSquare,
  WHATSAPP: MessageSquare,
};

// ── Components ───────────────────────────────

function PitchStatusBadge({ status }: { status: string }) {
  const config = PITCH_STATUS_CONFIG[status] ?? PITCH_STATUS_CONFIG['DRAFT'];
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', config.color)}>
      <Icon className="h-3 w-3" />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function GeneratePitchModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [leadId, setLeadId] = useState('');
  const [channel, setChannel] = useState<'EMAIL' | 'LINKEDIN' | 'WHATSAPP'>('EMAIL');

  // Fetch leads for the dropdown
  const { data: leadsData } = useQuery({
    queryKey: ['leads-for-pitch'],
    queryFn: () =>
      apiClient.get<{ leads: { id: string; companyName: string; contactName: string | null }[]; meta: { total: number } }>(
        '/leads?limit=100&page=1',
      ),
  });

  const generateMutation = useMutation({
    mutationFn: (data: { leadId: string; channel: string }) =>
      apiClient.post<Pitch>('/outreach/pitch', data),
    onSuccess: () => {
      toast.success('Pitch generated successfully');
      queryClient.invalidateQueries({ queryKey: ['outreach'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Generate AI Pitch</h2>
        <p className="mt-1 text-sm text-slate-500">Select a lead and channel to generate an outreach pitch</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Lead</label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">Select a lead...</option>
              {leadsData?.leads?.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.companyName} {lead.contactName ? `— ${lead.contactName}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Channel</label>
            <div className="mt-2 flex gap-2">
              {(['EMAIL', 'LINKEDIN', 'WHATSAPP'] as const).map((ch) => {
                const Icon = CHANNEL_ICONS[ch] ?? Mail;
                return (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                      channel === ch
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-950 dark:text-brand-300'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {ch.charAt(0) + ch.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={() => leadId && generateMutation.mutate({ leadId, channel })}
            disabled={!leadId || generateMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Pitch'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PitchDetailPanel({ pitch, onClose }: { pitch: Pitch; onClose: () => void }) {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: () => apiClient.post(`/outreach/pitch/${pitch.id}/approve`, {}),
    onSuccess: () => {
      toast.success('Pitch approved');
      queryClient.invalidateQueries({ queryKey: ['outreach'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: () => apiClient.post(`/outreach/pitch/${pitch.id}/send`, {}),
    onSuccess: () => {
      toast.success('Pitch sent!');
      queryClient.invalidateQueries({ queryKey: ['outreach'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {pitch.subject ?? 'Pitch'}
          </h2>
          <p className="text-sm text-slate-500">{pitch.lead?.companyName ?? ''}</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
          <XCircle className="h-5 w-5 text-slate-400" />
        </button>
      </div>

      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <PitchStatusBadge status={pitch.status} />
          <span className="text-xs text-slate-400">
            {pitch.channel} &middot; v{pitch.version}
          </span>
          {pitch.generatedByAi && (
            <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              AI Generated
            </span>
          )}
        </div>

        {pitch.subject && (
          <div>
            <p className="text-xs font-medium text-slate-500">Subject</p>
            <p className="mt-1 text-sm text-slate-900 dark:text-white">{pitch.subject}</p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-slate-500">Body</p>
          <div className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {pitch.body}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {pitch.status === 'PENDING_REVIEW' && (
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </button>
          )}
          {pitch.status === 'APPROVED' && (
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {sendMutation.isPending ? 'Sending...' : 'Send Pitch'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────

export default function OutreachPage() {
  const [tab, setTab] = useState<'pitches' | 'followups'>('pitches');
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedPitch, setSelectedPitch] = useState<Pitch | null>(null);
  const [search, setSearch] = useState('');

  // We'll fetch pitches by listing leads and getting their pitches
  // For now, use a simplified approach — fetch leads then their pitches
  const { data: leadsData } = useQuery({
    queryKey: ['outreach-leads'],
    queryFn: () =>
      apiClient.get<{ leads: { id: string; companyName: string; contactName: string | null; contactEmail: string | null; pitches?: Pitch[] }[]; meta: { total: number } }>(
        '/leads?limit=100&page=1',
      ),
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Outreach</h1>
          <p className="mt-1 text-sm text-slate-500">Manage pitches and follow-up sequences</p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Generate Pitch
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('pitches')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            tab === 'pitches'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Mail className="mr-2 inline h-4 w-4" />
          Pitches
        </button>
        <button
          onClick={() => setTab('followups')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            tab === 'followups'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Send className="mr-2 inline h-4 w-4" />
          Follow-ups
        </button>
      </div>

      {/* Search */}
      <div className="mt-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by company name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      </div>

      {/* Content */}
      {tab === 'pitches' && (
        <div className="mt-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="px-6 py-4 text-center text-sm text-slate-500">
              <Mail className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="mt-4">
                Generate AI-powered pitches for your leads.
              </p>
              <p className="mt-1 text-xs">
                Click &ldquo;Generate Pitch&rdquo; above to create a new pitch for a lead.
              </p>
              <button
                onClick={() => setShowGenerate(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" /> Generate Your First Pitch
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'followups' && (
        <div className="mt-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="px-6 py-4 text-center text-sm text-slate-500">
              <Send className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="mt-4">
                Follow-up sequences will appear here after you schedule them for a lead.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerate && <GeneratePitchModal onClose={() => setShowGenerate(false)} />}

      {/* Pitch Detail */}
      {selectedPitch && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelectedPitch(null)} />
          <PitchDetailPanel pitch={selectedPitch} onClose={() => setSelectedPitch(null)} />
        </>
      )}
    </div>
  );
}
