'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate, cn } from '@/lib/utils';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  XCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────

interface Proposal {
  id: string;
  leadId: string;
  callId: string | null;
  title: string;
  body: string;
  fileUrl: string | null;
  status: string;
  version: number;
  approvedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  lead?: { companyName: string; contactName: string | null };
}

// ── Constants ────────────────────────────────

const PROPOSAL_STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  DRAFT: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Clock },
  PENDING_REVIEW: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: Eye },
  APPROVED: { color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle2 },
  SENT: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: Send },
  ACCEPTED: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300', icon: CheckCircle2 },
  REJECTED: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: XCircle },
};

// ── Components ───────────────────────────────

function ProposalStatusBadge({ status }: { status: string }) {
  const config = PROPOSAL_STATUS_CONFIG[status] ?? PROPOSAL_STATUS_CONFIG['DRAFT'];
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', config.color)}>
      <Icon className="h-3 w-3" />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function GenerateProposalModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [leadId, setLeadId] = useState('');

  const { data: leadsData } = useQuery({
    queryKey: ['leads-for-proposal'],
    queryFn: () =>
      apiClient.get<{ leads: { id: string; companyName: string; contactName: string | null }[]; meta: { total: number } }>(
        '/leads?limit=100&page=1',
      ),
  });

  const generateMutation = useMutation({
    mutationFn: (data: { leadId: string }) =>
      apiClient.post<Proposal>('/proposals/generate', data),
    onSuccess: () => {
      toast.success('Proposal generated successfully');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-600" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Generate AI Proposal</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Select a lead to generate a tailored proposal using AI
        </p>

        <div className="mt-6">
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

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">
            Cancel
          </button>
          <button
            onClick={() => leadId && generateMutation.mutate({ leadId })}
            disabled={!leadId || generateMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProposalDetailPanel({
  proposal,
  onClose,
}: {
  proposal: Proposal;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: () => apiClient.post(`/proposals/${proposal.id}/approve`, {}),
    onSuccess: () => {
      toast.success('Proposal approved');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{proposal.title}</h2>
          <p className="text-sm text-slate-500">
            {proposal.lead?.companyName ?? ''} &middot; v{proposal.version}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
          <XCircle className="h-5 w-5 text-slate-400" />
        </button>
      </div>

      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <ProposalStatusBadge status={proposal.status} />
          {proposal.sentAt && (
            <span className="text-xs text-slate-400">Sent {formatDate(proposal.sentAt)}</span>
          )}
          {proposal.approvedAt && (
            <span className="text-xs text-slate-400">Approved {formatDate(proposal.approvedAt)}</span>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500">Proposal Content</p>
          <div className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {proposal.body}
          </div>
        </div>

        <div className="flex gap-3">
          {proposal.status === 'PENDING_REVIEW' && (
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Proposal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────

export default function ProposalsPage() {
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [search, setSearch] = useState('');

  // Note: There's no direct "list all proposals" endpoint. 
  // We show a proposal generation workflow. In production you'd add a /proposals endpoint.
  const { data: leadsData } = useQuery({
    queryKey: ['leads-with-proposals'],
    queryFn: () =>
      apiClient.get<{ leads: { id: string; companyName: string }[]; meta: { total: number } }>(
        '/leads?limit=50&page=1',
      ),
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Proposals</h1>
          <p className="mt-1 text-sm text-slate-500">AI-generated proposals and deal management</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Sparkles className="h-4 w-4" /> Generate Proposal
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mt-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search proposals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      </div>

      {/* Lead cards — click to see proposals */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(leadsData?.leads?.length ?? 0) === 0 ? (
          <div className="col-span-full rounded-xl bg-white p-12 text-center dark:bg-slate-900">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">
              No leads available. Add leads first, then generate proposals.
            </p>
          </div>
        ) : (
          leadsData?.leads
            ?.filter((l) => !search || l.companyName.toLowerCase().includes(search.toLowerCase()))
            .map((lead) => <LeadProposalCard key={lead.id} lead={lead} onSelectProposal={setSelectedProposal} />)
        )}
      </div>

      {/* Generate modal */}
      {showGenerate && <GenerateProposalModal onClose={() => setShowGenerate(false)} />}

      {/* Detail panel */}
      {selectedProposal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelectedProposal(null)} />
          <ProposalDetailPanel proposal={selectedProposal} onClose={() => setSelectedProposal(null)} />
        </>
      )}
    </div>
  );
}

function LeadProposalCard({
  lead,
  onSelectProposal,
}: {
  lead: { id: string; companyName: string };
  onSelectProposal: (p: Proposal) => void;
}) {
  const { data } = useQuery({
    queryKey: ['lead-proposals', lead.id],
    queryFn: () =>
      apiClient.get<{ proposals: Proposal[] }>(`/proposals/lead/${lead.id}`).catch(() => ({ proposals: [] })),
  });

  const proposals = data?.proposals ?? [];

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900">
      <h3 className="font-semibold text-slate-900 dark:text-white">{lead.companyName}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}
      </p>

      {proposals.length > 0 ? (
        <div className="mt-3 space-y-2">
          {proposals.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectProposal(p)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                {p.title}
              </span>
              <ProposalStatusBadge status={p.status} />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">No proposals generated yet</p>
      )}
    </div>
  );
}
