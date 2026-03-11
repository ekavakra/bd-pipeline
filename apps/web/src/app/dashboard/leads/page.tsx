'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, API_BASE } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatDate } from '@/lib/utils';
import {
  Search,
  Filter,
  Plus,
  X,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Check,
} from 'lucide-react';
import { useState, Fragment, useRef, useEffect } from 'react';
import { toast } from 'sonner';

/* ── Types ──────────────────────────────────────────── */

interface Lead {
  id: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactLinkedin: string | null;
  contactPhone: string | null;
  website: string | null;
  industry: string | null;
  companySize: string | null;
  location: string | null;
  source: string;
  discoverySource: string | null;
  discoveryReason: string | null;
  searchJobId: string | null;
  aiScore: number | null;
  scoreBreakdown: Record<string, unknown> | null;
  humanScoreOverride: number | null;
  status: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  reviewedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface SearchJob {
  id: string;
  searchBrief: string | null;
  status: string;
  leadsFound: number;
  filters: Record<string, unknown>;
  triggeredBy: { id: string; name: string } | null;
  createdAt: string;
  completedAt: string | null;
}

interface LeadsResponse {
  leads: Lead[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const STATUSES = [
  'ALL',
  'DISCOVERED',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'ON_HOLD',
  'CONTACTED',
  'RESPONDED',
  'IN_DISCOVERY',
  'PROPOSAL_SENT',
  'DEAL_CLOSED',
  'LOST',
] as const;

const SOURCES = ['AI_SEARCH', 'MANUAL', 'REFERRAL', 'INBOUND'] as const;

const EMPTY_FORM = {
  companyName: '',
  contactName: '',
  contactEmail: '',
  contactLinkedin: '',
  contactPhone: '',
  website: '',
  industry: '',
  companySize: '',
  location: '',
  source: 'MANUAL' as string,
};

/* ── Page ───────────────────────────────────────────── */

export default function LeadsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'all' | 'grouped'>('grouped');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [reviewLead, setReviewLead] = useState<Lead | null>(null);
  const [showAiSearch, setShowAiSearch] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const qs = new URLSearchParams({
    page: String(page),
    limit: '20',
    ...(search && { search }),
    ...(statusFilter !== 'ALL' && { status: statusFilter }),
    ...(selectedJobId && { searchJobId: selectedJobId }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['leads', { page, search, statusFilter, selectedJobId }],
    queryFn: () => apiClient.get<LeadsResponse>(`/leads?${qs}`),
  });

  const { data: searchJobs } = useQuery({
    queryKey: ['search-jobs'],
    queryFn: () => apiClient.get<SearchJob[]>('/leads/search-jobs'),
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leads</h1>
          <p className="mt-1 text-sm text-slate-500">{data?.meta?.total ?? 0} total leads</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> Add Lead
          </button>
          <button
            onClick={() => setShowAiSearch(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Sparkles className="h-4 w-4" /> AI Search
          </button>
        </div>
      </div>

      {/* View Toggle + Search & Filters */}
      <div className="mt-6 flex gap-3">
        <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
          <button
            onClick={() => { setViewMode('grouped'); setSelectedJobId(null); setPage(1); }}
            className={`px-3 py-2 text-sm font-medium ${viewMode === 'grouped' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
          >
            By Search
          </button>
          <button
            onClick={() => { setViewMode('all'); setSelectedJobId(null); setPage(1); }}
            className={`px-3 py-2 text-sm font-medium ${viewMode === 'all' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
          >
            All Leads
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-lg border border-slate-300 py-2 pl-4 pr-10 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Grouped View: Search Jobs with Leads */}
      {viewMode === 'grouped' && !selectedJobId && (
        <div className="mt-6 space-y-4">
          {searchJobs && searchJobs.length > 0 ? (
            searchJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
              >
                <button
                  onClick={() => { setSelectedJobId(job.id); setPage(1); }}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 flex-shrink-0 text-brand-500" />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {job.searchBrief ?? 'AI Search'}
                      </h3>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span>{job.leadsFound} lead{job.leadsFound !== 1 ? 's' : ''}</span>
                      <span>{formatDate(job.createdAt)}</span>
                      {job.triggeredBy && <span>by {job.triggeredBy.name}</span>}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 -rotate-90 text-slate-400 flex-shrink-0" />
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              No searches yet. Start an AI search to discover leads.
            </div>
          )}
        </div>
      )}

      {/* Filtered Job Header (when a specific search job is selected) */}
      {selectedJobId && (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => { setSelectedJobId(null); setPage(1); }}
            className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-3 w-3" /> Back to all searches
          </button>
          {searchJobs && (() => {
            const job = searchJobs.find((j) => j.id === selectedJobId);
            return job ? (
              <span className="text-sm text-slate-500">
                Showing results for: <strong className="text-slate-700 dark:text-slate-300">{job.searchBrief ?? 'AI Search'}</strong>
              </span>
            ) : null;
          })()}
        </div>
      )}

      {/* Table — shown in "All Leads" mode or when a specific job is selected */}
      {(viewMode === 'all' || selectedJobId) && (
        <>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-500">Company</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Contact</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Industry</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Source</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Score</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Added</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : data?.leads?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      No leads found. Start an AI search to discover leads.
                    </td>
                  </tr>
                ) : (
                  data?.leads?.map((lead) => (
                    <tr
                      key={lead.id}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      onClick={() => setDetailLead(lead)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {lead.companyName}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        {lead.contactName ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        {lead.industry ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        <SourceBadge source={lead.discoverySource} />
                      </td>
                      <td className="px-6 py-4">
                        {lead.aiScore != null ? <ScoreBadge score={lead.aiScore} /> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatDate(lead.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setEditLead(lead)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {['DISCOVERED', 'PENDING_REVIEW'].includes(lead.status) && (
                            <button
                              onClick={() => setReviewLead(lead)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                              title="Review"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data?.meta && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
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
        </>
      )}

      {/* ── Modals ────────────────────────────────── */}
      {showCreate && <CreateLeadModal onClose={() => setShowCreate(false)} />}
      {editLead && <EditLeadModal lead={editLead} onClose={() => setEditLead(null)} />}
      {reviewLead && <ReviewLeadPanel lead={reviewLead} onClose={() => setReviewLead(null)} />}
      {showAiSearch && <AiSearchModal onClose={() => setShowAiSearch(false)} />}
      {detailLead && <LeadDetailPanel lead={detailLead} onClose={() => setDetailLead(null)} onEdit={() => { setEditLead(detailLead); setDetailLead(null); }} onReview={() => { setReviewLead(detailLead); setDetailLead(null); }} />}
    </div>
  );
}

/* ── Create Lead Modal ──────────────────────────────── */

function CreateLeadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      return apiClient.post('/leads', body);
    },
    onSuccess: () => {
      toast.success('Lead created');
      qc.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create lead'),
  });

  return (
    <ModalShell title="Add New Lead" onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Company Name *" value={form.companyName} onChange={(v) => set('companyName', v)} className="col-span-2" />
        <Input label="Contact Name" value={form.contactName} onChange={(v) => set('contactName', v)} />
        <Input label="Contact Email" value={form.contactEmail} onChange={(v) => set('contactEmail', v)} type="email" />
        <Input label="Phone" value={form.contactPhone} onChange={(v) => set('contactPhone', v)} />
        <Input label="LinkedIn" value={form.contactLinkedin} onChange={(v) => set('contactLinkedin', v)} />
        <Input label="Website" value={form.website} onChange={(v) => set('website', v)} />
        <Input label="Industry" value={form.industry} onChange={(v) => set('industry', v)} />
        <Input label="Company Size" value={form.companySize} onChange={(v) => set('companySize', v)} />
        <Input label="Location" value={form.location} onChange={(v) => set('location', v)} />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Source</label>
          <select
            value={form.source}
            onChange={(e) => set('source', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">
          Cancel
        </button>
        <button
          onClick={() => mutate()}
          disabled={!form.companyName.trim() || isPending}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create Lead
        </button>
      </div>
    </ModalShell>
  );
}

/* ── Edit Lead Modal ────────────────────────────────── */

function EditLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    companyName: lead.companyName,
    contactName: lead.contactName ?? '',
    contactEmail: lead.contactEmail ?? '',
    contactLinkedin: lead.contactLinkedin ?? '',
    contactPhone: lead.contactPhone ?? '',
    website: lead.website ?? '',
    industry: lead.industry ?? '',
    companySize: lead.companySize ?? '',
    location: lead.location ?? '',
    status: lead.status,
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(
        Object.entries(form).filter(([k, v]) => {
          if (k === 'companyName') return true;
          return v !== '';
        }),
      );
      return apiClient.patch(`/leads/${lead.id}`, body);
    },
    onSuccess: () => {
      toast.success('Lead updated');
      qc.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to update lead'),
  });

  return (
    <ModalShell title={`Edit — ${lead.companyName}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Company Name *" value={form.companyName} onChange={(v) => set('companyName', v)} className="col-span-2" />
        <Input label="Contact Name" value={form.contactName} onChange={(v) => set('contactName', v)} />
        <Input label="Contact Email" value={form.contactEmail} onChange={(v) => set('contactEmail', v)} type="email" />
        <Input label="Phone" value={form.contactPhone} onChange={(v) => set('contactPhone', v)} />
        <Input label="LinkedIn" value={form.contactLinkedin} onChange={(v) => set('contactLinkedin', v)} />
        <Input label="Website" value={form.website} onChange={(v) => set('website', v)} />
        <Input label="Industry" value={form.industry} onChange={(v) => set('industry', v)} />
        <Input label="Company Size" value={form.companySize} onChange={(v) => set('companySize', v)} />
        <Input label="Location" value={form.location} onChange={(v) => set('location', v)} />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            {STATUSES.filter((s) => s !== 'ALL').map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">Cancel</button>
        <button
          onClick={() => mutate()}
          disabled={!form.companyName.trim() || isPending}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes
        </button>
      </div>
    </ModalShell>
  );
}

/* ── Review Panel (slide-over) ──────────────────────── */

function ReviewLeadPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');

  const review = useMutation({
    mutationFn: (decision: string) =>
      apiClient.post(`/leads/${lead.id}/review`, { decision, notes: notes || undefined }),
    onSuccess: (_, decision) => {
      toast.success(`Lead ${decision.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? 'Review failed'),
  });

  return (
    <SlideOver title={`Review — ${lead.companyName}`} onClose={onClose}>
      <div className="space-y-4">
        <InfoRow label="Contact" value={lead.contactName ?? '—'} />
        <InfoRow label="Email" value={lead.contactEmail ?? '—'} />
        <InfoRow label="Industry" value={lead.industry ?? '—'} />
        <InfoRow label="Score" value={lead.aiScore != null ? String(lead.aiScore) : '—'} />

        {lead.scoreBreakdown && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Score Breakdown</p>
            <div className="space-y-1.5">
              {Object.entries(lead.scoreBreakdown)
                .filter(([k]) => !k.startsWith('_'))
                .map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-32 text-xs text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-2 rounded-full bg-brand-500"
                      style={{ width: `${Math.min(100, Number(v))}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Review Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => review.mutate('APPROVED')}
            disabled={review.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> Approve
          </button>
          <button
            onClick={() => review.mutate('ON_HOLD')}
            disabled={review.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            <Clock className="h-4 w-4" /> Hold
          </button>
          <button
            onClick={() => review.mutate('REJECTED')}
            disabled={review.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" /> Reject
          </button>
        </div>
      </div>
    </SlideOver>
  );
}

/* ── AI Search Modal ─────────────────────────────────── */

type SearchStage = 'form' | 'progress' | 'done';

interface ProgressEvent {
  step: string;
  progress: number;
  message: string;
  resultCount?: number;
}

function AiSearchModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [stage, setStage] = useState<SearchStage>('form');
  const [form, setForm] = useState({
    naturalQuery: '',
    industry: '',
    location: '',
    companySize: '',
    keywords: '',
    maxResults: '20',
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Scoring preference sliders
  const [preferences, setPreferences] = useState([
    { factor: 'industry_match', label: 'Industry Match', weight: 30 },
    { factor: 'location_match', label: 'Location Match', weight: 25 },
    { factor: 'company_size_fit', label: 'Company Size Fit', weight: 20 },
    { factor: 'contact_info', label: 'Has Contact Info', weight: 15 },
    { factor: 'source_quality', label: 'Source Quality', weight: 10 },
  ]);
  const [showPrefs, setShowPrefs] = useState(false);

  const updatePrefWeight = (idx: number, weight: number) => {
    setPreferences((prev) => prev.map((p, i) => i === idx ? { ...p, weight } : p));
  };

  const totalWeight = preferences.reduce((s, p) => s + p.weight, 0);

  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  const startSearch = async () => {
    const body: Record<string, unknown> = {};
    if (form.naturalQuery) body['naturalQuery'] = form.naturalQuery;
    if (form.industry) body['industry'] = form.industry;
    if (form.location) body['location'] = form.location;
    if (form.companySize) body['companySize'] = form.companySize;
    if (form.keywords) body['keywords'] = form.keywords.split(',').map((s) => s.trim()).filter(Boolean);
    body['maxResults'] = parseInt(form.maxResults) || 20;
    body['preferences'] = preferences;

    setIsSubmitting(true);
    try {
      const res = await apiClient.post<{ jobId: string }>('/leads/search', body);
      const { jobId } = res;

      setStage('progress');
      setProgress(0);
      setCurrentMessage('Connecting to search engine…');
      setCompletedSteps([]);

      // EventSource doesn't support custom headers, so we pass the access token
      // as a query param. The backend authenticateSse middleware handles this.
      const url = `${API_BASE}/leads/search/${jobId}/stream?token=${encodeURIComponent(accessToken ?? '')}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (e) => {
        let data: ProgressEvent;
        try { data = JSON.parse(e.data) as ProgressEvent; } catch { return; }

        setProgress(data.progress);
        setCurrentMessage(data.message);

        if (data.step !== 'complete' && data.step !== 'error') {
          setCompletedSteps((prev) => [...prev, data.message]);
        }
        if (data.step === 'complete') {
          setResultCount(data.resultCount ?? 0);
          qc.invalidateQueries({ queryKey: ['leads'] });
          qc.invalidateQueries({ queryKey: ['search-jobs'] });
          setStage('done');
          es.close();
        }
        if (data.step === 'error') {
          toast.error(data.message ?? 'Search failed');
          setStage('form');
          es.close();
        }
      };

      es.onerror = () => {
        setStage((prev) => {
          if (prev === 'progress') {
            toast.error('Lost connection to search stream');
            return 'form';
          }
          return prev;
        });
        es.close();
      };
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to start search');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─ Form view ──────────────────────────────────────── */
  if (stage === 'form') {
    return (
      <ModalShell title="AI Lead Search" onClose={onClose}>
        {/* Natural language textarea */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Describe what you&apos;re looking for
            <span className="ml-1 text-xs font-normal text-slate-400">(optional — AI will understand this)</span>
          </label>
          <textarea
            rows={3}
            value={form.naturalQuery}
            onChange={(e) => set('naturalQuery', e.target.value)}
            placeholder="e.g. B2B SaaS companies in NYC hiring engineers, with 50-200 employees, ideally in HR or payroll space"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span>or filter by field</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Industry" value={form.industry} onChange={(v) => set('industry', v)} placeholder="e.g. SaaS, Fintech" />
          <Input label="Location" value={form.location} onChange={(v) => set('location', v)} placeholder="e.g. New York, USA" />
          <Input label="Company Size" value={form.companySize} onChange={(v) => set('companySize', v)} placeholder="e.g. 50-200" />
          <Input label="Max Results" value={form.maxResults} onChange={(v) => set('maxResults', v)} type="number" />
          <Input label="Keywords (comma separated)" value={form.keywords} onChange={(v) => set('keywords', v)} placeholder="e.g. AI, ML, data" className="col-span-2" />
        </div>

        {/* Scoring Preferences */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowPrefs(!showPrefs)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPrefs ? '' : '-rotate-90'}`} />
            Scoring Preferences
            <span className="text-xs text-slate-400">(priority weights)</span>
          </button>
          {showPrefs && (
            <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">
                Adjust how much each factor matters when scoring leads. Higher weight = more important.
              </p>
              {preferences.map((pref, idx) => (
                <div key={pref.factor} className="flex items-center gap-3">
                  <span className="w-36 text-sm text-slate-700 dark:text-slate-300">{pref.label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={pref.weight}
                    onChange={(e) => updatePrefWeight(idx, parseInt(e.target.value))}
                    className="flex-1 accent-brand-600"
                  />
                  <span className="w-10 text-right text-sm font-mono text-slate-600 dark:text-slate-400">
                    {totalWeight > 0 ? Math.round((pref.weight / totalWeight) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">Cancel</button>
          <button
            onClick={startSearch}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Start Search
          </button>
        </div>
      </ModalShell>
    );
  }

  /* ─ Progress view ──────────────────────────────────── */
  if (stage === 'progress') {
    return (
      <ModalShell title="AI Lead Search" onClose={() => { esRef.current?.close(); onClose(); }}>
        <div className="py-3 space-y-5">
          {/* Animated progress bar */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Searching for leads…</span>
              <span className="text-sm font-semibold text-brand-600">{progress}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0 text-brand-500" />
              {currentMessage}
            </p>
          </div>

          {/* Completed-steps checklist */}
          {completedSteps.length > 0 && (
            <ul className="space-y-1.5">
              {completedSteps.map((msg, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </span>
                  {msg}
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-slate-400">
            You can close this window — the search will complete in the background.
          </p>
        </div>
      </ModalShell>
    );
  }

  /* ─ Done view ──────────────────────────────────────── */
  return (
    <ModalShell title="AI Lead Search" onClose={onClose}>
      <div className="py-6 flex flex-col items-center gap-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-9 w-9 text-green-600 dark:text-green-400" />
        </span>
        <div>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">Search Complete!</p>
          <p className="mt-1 text-sm text-slate-500">
            {resultCount > 0
              ? `${resultCount} new lead${resultCount !== 1 ? 's' : ''} discovered and added to your pipeline.`
              : 'No leads matched your criteria. Try broadening your search.'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-2 rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          View Leads
        </button>
      </div>
    </ModalShell>
  );
}

/* ── Lead Detail Panel (slide-over) ─────────────────── */

function LeadDetailPanel({
  lead,
  onClose,
  onEdit,
  onReview,
}: {
  lead: Lead;
  onClose: () => void;
  onEdit: () => void;
  onReview: () => void;
}) {
  return (
    <SlideOver title={lead.companyName} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <StatusBadge status={lead.status} />
          {lead.aiScore != null && <ScoreBadge score={lead.aiScore} />}
          <SourceBadge source={lead.discoverySource} />
          <span className="ml-auto text-xs text-slate-400">{lead.source.replace(/_/g, ' ')}</span>
        </div>

        {lead.discoveryReason && (
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
            {lead.discoveryReason}
          </div>
        )}

        <InfoRow label="Contact" value={lead.contactName ?? '—'} />
        <InfoRow label="Email" value={lead.contactEmail ?? '—'} />
        <InfoRow label="Phone" value={lead.contactPhone ?? '—'} />
        {lead.contactLinkedin && (
          <InfoRow label="LinkedIn">
            <a href={lead.contactLinkedin} target="_blank" rel="noopener" className="flex items-center gap-1 text-brand-600 hover:underline">
              Profile <ExternalLink className="h-3 w-3" />
            </a>
          </InfoRow>
        )}
        {lead.website && (
          <InfoRow label="Website">
            <a href={lead.website} target="_blank" rel="noopener" className="flex items-center gap-1 text-brand-600 hover:underline">
              {new URL(lead.website).hostname} <ExternalLink className="h-3 w-3" />
            </a>
          </InfoRow>
        )}
        <InfoRow label="Industry" value={lead.industry ?? '—'} />
        <InfoRow label="Company Size" value={lead.companySize ?? '—'} />
        <InfoRow label="Location" value={lead.location ?? '—'} />
        <InfoRow label="Assigned To" value={lead.assignedTo?.name ?? '—'} />
        <InfoRow label="Added" value={formatDate(lead.createdAt)} />

        {lead.scoreBreakdown && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Score Breakdown</p>
            <div className="space-y-1.5">
              {Object.entries(lead.scoreBreakdown)
                .filter(([k]) => !k.startsWith('_'))
                .map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-32 text-xs text-slate-500 capitalize">{k.replace(/_/g, ' ')}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.min(100, Number(v))}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {lead.reviewNotes && <InfoRow label="Review Notes" value={lead.reviewNotes} />}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
          {['DISCOVERED', 'PENDING_REVIEW'].includes(lead.status) && (
            <button
              onClick={onReview}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <CheckCircle2 className="h-4 w-4" /> Review
            </button>
          )}
        </div>
      </div>
    </SlideOver>
  );
}

/* ── Shared UI Components ───────────────────────────── */

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

function SlideOver({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
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

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
      />
    </div>
  );
}

function InfoRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-slate-500">{label}</span>
      {children ?? <span className="text-sm font-medium text-slate-900 dark:text-white">{value}</span>}
    </div>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-xs text-slate-400">—</span>;
  const map: Record<string, { icon: string; label: string; color: string }> = {
    web_search: { icon: '🌐', label: 'Web', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
    apollo: { icon: '🔗', label: 'Apollo', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    ai_generated: { icon: '🤖', label: 'AI', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  };
  const info = map[source] ?? { icon: '📦', label: source, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${info.color}`}>
      {info.icon} {info.label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      : score >= 40
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>{score}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    DISCOVERED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    PENDING_REVIEW: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    ON_HOLD: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    CONTACTED: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    RESPONDED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
    IN_DISCOVERY: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
    PROPOSAL_SENT: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
    DEAL_CLOSED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    LOST: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorMap[status] ?? colorMap['DISCOVERED']}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
