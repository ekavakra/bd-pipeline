'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import {
  Building2,
  Search,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Plus,
  X,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────

interface Pipeline {
  id: string;
  currentStage: string;
  healthStatus: string;
  startedAt: string;
  completedAt: string | null;
}

interface Client {
  id: string;
  companyName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  contractValue: string | null;
  contractStart: string | null;
  status: string;
  assignedManagerId: string;
  createdAt: string;
  onboardingPipeline: Pipeline | null;
}

interface ClientsResponse {
  clients: Client[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface ChecklistItem {
  id: string;
  stage: string;
  title: string;
  description: string | null;
  isMandatory: boolean;
  isCompleted: boolean;
  completedAt: string | null;
}

// ── Constants ────────────────────────────────

const STAGES = [
  'DEAL_CLOSED',
  'KICKOFF',
  'REQUIREMENTS_GATHERING',
  'DOCUMENTATION',
  'TECHNICAL_SETUP',
  'TESTING_UAT',
  'GO_LIVE',
  'TRAINING',
  'COMPLETED',
] as const;

const STAGE_LABELS: Record<string, string> = {
  DEAL_CLOSED: 'Deal Closed',
  KICKOFF: 'Kickoff',
  REQUIREMENTS_GATHERING: 'Requirements',
  DOCUMENTATION: 'Documentation',
  TECHNICAL_SETUP: 'Technical Setup',
  TESTING_UAT: 'Testing & UAT',
  GO_LIVE: 'Go Live',
  TRAINING: 'Training',
  COMPLETED: 'Completed',
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  ON_TRACK: { color: 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-400', icon: CheckCircle2 },
  AT_RISK: { color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-400', icon: Clock },
  OVERDUE: { color: 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-400', icon: AlertTriangle },
  STALLED: { color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400', icon: XCircle },
};

const CLIENT_STATUS_COLORS: Record<string, string> = {
  ONBOARDING: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  AT_RISK: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  CHURNED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

// ── Components ───────────────────────────────

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

function CreateClientModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    companyName: '',
    primaryContactName: '',
    primaryContactEmail: '',
    primaryContactPhone: '',
    contractValue: '',
    assignedManagerId: '',
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const { data: users } = useQuery({
    queryKey: ['team-users'],
    queryFn: () => apiClient.get<{ users: TeamUser[] }>('/users').catch(() => ({ users: [] })),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        companyName: form.companyName,
        primaryContactName: form.primaryContactName,
        primaryContactEmail: form.primaryContactEmail,
        assignedManagerId: form.assignedManagerId,
      };
      if (form.primaryContactPhone) body['primaryContactPhone'] = form.primaryContactPhone;
      if (form.contractValue) body['contractValue'] = parseFloat(form.contractValue);
      return apiClient.post('/clients', body);
    },
    onSuccess: () => {
      toast.success('Client created');
      qc.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create client'),
  });

  const valid = form.companyName && form.primaryContactName && form.primaryContactEmail && form.assignedManagerId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Client</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Company Name *</label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => set('companyName', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Name *</label>
              <input
                type="text"
                value={form.primaryContactName}
                onChange={(e) => set('primaryContactName', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Email *</label>
              <input
                type="email"
                value={form.primaryContactEmail}
                onChange={(e) => set('primaryContactEmail', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Phone</label>
              <input
                type="text"
                value={form.primaryContactPhone}
                onChange={(e) => set('primaryContactPhone', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Contract Value ($)</label>
              <input
                type="number"
                value={form.contractValue}
                onChange={(e) => set('contractValue', e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Assigned Manager *</label>
            <select
              value={form.assignedManagerId}
              onChange={(e) => set('assignedManagerId', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">Select manager...</option>
              {users?.users?.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, ' ')})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">Cancel</button>
          <button
            onClick={() => mutate()}
            disabled={!valid || isPending}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create Client
          </button>
        </div>
      </div>
    </div>
  );
}

function HealthBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['ON_TRACK']!;
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', config!.color)}>
      <Icon className="h-3 w-3" />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function PipelineTimeline({ currentStage }: { currentStage: string }) {
  const currentIdx = STAGES.indexOf(currentStage as typeof STAGES[number]);

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1">
          <div
            className={cn(
              'h-2.5 w-2.5 rounded-full transition-colors',
              i < currentIdx
                ? 'bg-green-500'
                : i === currentIdx
                  ? 'bg-brand-600 ring-2 ring-brand-200'
                  : 'bg-slate-200 dark:bg-slate-700',
            )}
            title={STAGE_LABELS[stage]}
          />
          {i < STAGES.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-3',
                i < currentIdx ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ClientDetailPanel({
  client,
  onClose,
}: {
  client: Client;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: checklistData } = useQuery({
    queryKey: ['client-checklist', client.id],
    queryFn: () => apiClient.get<{ items: ChecklistItem[] }>(`/clients/${client.id}/checklist`),
    enabled: !!client.onboardingPipeline,
  });

  const advanceMutation = useMutation({
    mutationFn: () => apiClient.post(`/clients/${client.id}/pipeline/advance`, {}),
    onSuccess: () => {
      toast.success('Pipeline advanced to next stage');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-checklist', client.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-clients'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) =>
      apiClient.patch(`/clients/${client.id}/checklist/${itemId}`, { isCompleted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-checklist', client.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const currentStage = client.onboardingPipeline?.currentStage ?? 'DEAL_CLOSED';
  const currentIdx = STAGES.indexOf(currentStage as typeof STAGES[number]);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto bg-white shadow-2xl dark:bg-slate-900 lg:max-w-xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{client.companyName}</h2>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
          <XCircle className="h-5 w-5 text-slate-400" />
        </button>
      </div>

      <div className="space-y-6 p-6">
        {/* Client info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Contact</p>
            <p className="font-medium text-slate-900 dark:text-white">{client.primaryContactName}</p>
          </div>
          <div>
            <p className="text-slate-500">Email</p>
            <p className="font-medium text-slate-900 dark:text-white">{client.primaryContactEmail}</p>
          </div>
          <div>
            <p className="text-slate-500">Contract Value</p>
            <p className="font-medium text-slate-900 dark:text-white">
              {client.contractValue ? formatCurrency(Number(client.contractValue)) : '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Status</p>
            <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', CLIENT_STATUS_COLORS[client.status] ?? CLIENT_STATUS_COLORS['ONBOARDING'])}>
              {client.status}
            </span>
          </div>
        </div>

        {/* Pipeline progress */}
        {client.onboardingPipeline && (
          <div>
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Onboarding Pipeline</h3>
            <div className="space-y-3">
              {STAGES.map((stage, i) => (
                <div
                  key={stage}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm',
                    i < currentIdx
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                      : i === currentIdx
                        ? 'border-brand-300 bg-brand-50 font-semibold text-brand-700 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300'
                        : 'border-slate-200 text-slate-400 dark:border-slate-700',
                  )}
                >
                  {i < currentIdx ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : i === currentIdx ? (
                    <ArrowRight className="h-4 w-4 text-brand-600" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                  )}
                  {STAGE_LABELS[stage]}
                </div>
              ))}
            </div>

            {currentStage !== 'COMPLETED' && (
              <button
                onClick={() => advanceMutation.mutate()}
                disabled={advanceMutation.isPending}
                className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {advanceMutation.isPending ? 'Advancing...' : `Advance to ${STAGE_LABELS[STAGES[currentIdx + 1] ?? ''] ?? 'Next'}`}
              </button>
            )}
          </div>
        )}

        {/* Checklist */}
        {checklistData?.items && checklistData.items.length > 0 && (
          <div>
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Checklist</h3>
            <div className="space-y-2">
              {checklistData.items
                .filter((item) => item.stage === currentStage)
                .map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      onChange={() =>
                        toggleChecklistMutation.mutate({
                          itemId: item.id,
                          isCompleted: !item.isCompleted,
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <div className="flex-1">
                      <p className={cn('text-sm', item.isCompleted && 'text-slate-400 line-through')}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-slate-400">{item.description}</p>
                      )}
                    </div>
                    {item.isMandatory && (
                      <span className="text-xs text-red-500">Required</span>
                    )}
                  </label>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────

export default function ClientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { page, search }],
    queryFn: () =>
      apiClient.get<ClientsResponse>(
        `/clients?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data?.meta?.total ?? 0} clients &middot; Manage onboarding pipelines
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New Client
        </button>
      </div>

      {/* Search */}
      <div className="mt-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      </div>

      {/* Client cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-white dark:bg-slate-900" />
          ))
        ) : data?.clients?.length === 0 ? (
          <div className="col-span-full rounded-xl bg-white p-12 text-center dark:bg-slate-900">
            <Building2 className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">No clients yet. Close a deal to start onboarding.</p>
          </div>
        ) : (
          data?.clients?.map((client) => (
            <button
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className="group rounded-xl bg-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:bg-slate-900"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-900 dark:text-white">
                    {client.companyName}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">{client.primaryContactName}</p>
                </div>
                <HealthBadge status={client.onboardingPipeline?.healthStatus ?? 'ON_TRACK'} />
              </div>

              {/* Stage info */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{STAGE_LABELS[client.onboardingPipeline?.currentStage ?? ''] ?? 'Unknown'}</span>
                  <span>
                    {client.contractValue ? formatCurrency(Number(client.contractValue)) : '—'}
                  </span>
                </div>
                <div className="mt-2">
                  <PipelineTimeline currentStage={client.onboardingPipeline?.currentStage ?? 'DEAL_CLOSED'} />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>Since {formatDate(client.createdAt)}</span>
                <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </button>
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

      {/* Detail slide-over */}
      {selectedClient && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSelectedClient(null)}
          />
          <ClientDetailPanel
            client={selectedClient}
            onClose={() => setSelectedClient(null)}
          />
        </>
      )}

      {/* Create modal */}
      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
