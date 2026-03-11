'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import {
  Users,
  Mail,
  Building2,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Clock,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

interface Lead {
  id: string;
  companyName: string;
  contactName: string | null;
  status: string;
  aiScore: number | null;
  createdAt: string;
}

interface Client {
  id: string;
  companyName: string;
  status: string;
  onboardingPipeline?: { currentStage: string; healthStatus: string } | null;
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs text-slate-400 group-hover:text-brand-600">
        <span>View details</span>
        <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ON_TRACK: 'bg-green-500',
    AT_RISK: 'bg-yellow-500',
    OVERDUE: 'bg-red-500',
    STALLED: 'bg-slate-400',
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status] ?? 'bg-slate-400'}`} />;
}

export default function DashboardPage() {
  const { data: leadsData } = useQuery({
    queryKey: ['dashboard-leads'],
    queryFn: () =>
      apiClient.get<{ leads: Lead[]; meta: { total: number } }>('/leads?limit=5&page=1'),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['dashboard-clients'],
    queryFn: () =>
      apiClient.get<{ clients: Client[]; meta: { total: number } }>('/clients?limit=5&page=1'),
  });

  const { data: slaData } = useQuery({
    queryKey: ['dashboard-sla'],
    queryFn: () =>
      apiClient.get<{ breaches: unknown[] }>('/clients/sla/breaches').catch(() => ({ breaches: [] })),
  });

  const totalLeads = leadsData?.meta?.total ?? 0;
  const totalClients = clientsData?.meta?.total ?? 0;
  const slaBreaches = slaData?.breaches?.length ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your business development pipeline
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Leads"
          value={totalLeads}
          icon={Users}
          color="bg-blue-500"
          href="/dashboard/leads"
        />
        <StatCard
          title="Active Outreach"
          value="—"
          icon={Mail}
          color="bg-green-500"
          href="/dashboard/outreach"
        />
        <StatCard
          title="Active Clients"
          value={totalClients}
          icon={Building2}
          color="bg-purple-500"
          href="/dashboard/clients"
        />
        <StatCard
          title="SLA Breaches"
          value={slaBreaches}
          icon={AlertTriangle}
          color={slaBreaches > 0 ? 'bg-red-500' : 'bg-slate-400'}
          href="/dashboard/clients"
        />
      </div>

      {/* Two-column sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leads */}
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Leads</h2>
            <Link
              href="/dashboard/leads"
              className="text-sm text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {leadsData?.leads?.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No leads yet. Run an AI search to get started.</p>
            )}
            {leadsData?.leads?.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{lead.companyName}</p>
                  <p className="text-xs text-slate-500">{lead.contactName ?? 'No contact'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {lead.aiScore != null && (
                    <span className="flex items-center gap-1 text-xs">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      {lead.aiScore}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{formatDate(lead.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Client Pipeline */}
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Client Pipeline</h2>
            <Link
              href="/dashboard/clients"
              className="text-sm text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {clientsData?.clients?.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No clients yet. Close a deal to start onboarding.</p>
            )}
            {clientsData?.clients?.map((client) => (
              <div key={client.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{client.companyName}</p>
                  <p className="text-xs text-slate-500">
                    {client.onboardingPipeline?.currentStage?.replace(/_/g, ' ') ?? client.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot status={client.onboardingPipeline?.healthStatus ?? 'ON_TRACK'} />
                  <span className="text-xs text-slate-400">
                    {client.onboardingPipeline?.healthStatus?.replace(/_/g, ' ') ?? client.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Quick Actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/dashboard/leads"
            className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-600 dark:hover:bg-brand-950"
          >
            <Users className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium">Search Leads</span>
          </Link>
          <Link
            href="/dashboard/outreach"
            className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-600 dark:hover:bg-brand-950"
          >
            <Mail className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium">Generate Pitch</span>
          </Link>
          <Link
            href="/dashboard/proposals"
            className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-600 dark:hover:bg-brand-950"
          >
            <FileText className="h-5 w-5 text-purple-500" />
            <span className="text-sm font-medium">Create Proposal</span>
          </Link>
          <Link
            href="/dashboard/calls"
            className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:border-brand-600 dark:hover:bg-brand-950"
          >
            <Clock className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium">Schedule Meeting</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
