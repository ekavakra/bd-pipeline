'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  Brain,
  Sparkles,
  Mail,
  TrendingUp,
  Loader2,
  ArrowRight,
  Target,
  BarChart3,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────

interface NextActionResult {
  action: string;
  reason: string;
  priority: string;
  details?: Record<string, unknown>;
}

interface GeneratedEmail {
  id: string;
  subject: string;
  body: string;
  status: string;
}

// ── Components ───────────────────────────────

function ActionCard({
  title,
  description,
  icon: Icon,
  color,
  onClick,
  loading,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="group flex items-start gap-4 rounded-xl bg-white p-6 text-left shadow-sm transition-all hover:shadow-md disabled:opacity-60 dark:bg-slate-900"
    >
      <div className={cn('rounded-xl p-3', color)}>
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        ) : (
          <Icon className="h-6 w-6 text-white" />
        )}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
          Run <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

function ResultCard({ result }: { result: NextActionResult }) {
  const priorityColors: Record<string, string> = {
    HIGH: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    LOW: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">{result.action}</h3>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', priorityColors[result.priority] ?? priorityColors['MEDIUM'])}>
          {result.priority}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{result.reason}</p>
    </div>
  );
}

function EmailGeneratorPanel() {
  const [leadId, setLeadId] = useState('');
  const [emailType, setEmailType] = useState<'FOLLOWUP' | 'PITCH' | 'ONBOARDING_UPDATE' | 'CUSTOM'>('FOLLOWUP');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);

  const generateMutation = useMutation({
    mutationFn: (data: { leadId?: string; type: string; prompt?: string }) =>
      apiClient.post<GeneratedEmail>('/ai/email/generate', data),
    onSuccess: (data) => {
      setGeneratedEmail(data);
      toast.success('Email generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-brand-600" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">AI Email Generator</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Generate contextual emails for your leads and clients
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email Type</label>
            <select
              value={emailType}
              onChange={(e) => setEmailType(e.target.value as typeof emailType)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="FOLLOWUP">Follow-up</option>
              <option value="PITCH">Pitch</option>
              <option value="ONBOARDING_UPDATE">Onboarding Update</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          {emailType === 'CUSTOM' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Prompt</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe the email you want to generate..."
                rows={3}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          )}

          <button
            onClick={() =>
              generateMutation.mutate({
                type: emailType,
                prompt: customPrompt || undefined,
                leadId: leadId || undefined,
              })
            }
            disabled={generateMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Email
              </>
            )}
          </button>
        </div>

        {/* Preview */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          {generatedEmail ? (
            <div>
              <p className="text-xs font-medium text-slate-500">Subject</p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                {generatedEmail.subject}
              </p>
              <p className="mt-4 text-xs font-medium text-slate-500">Body</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                {generatedEmail.body}
              </p>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center py-8">
              <p className="text-sm text-slate-400">Generated email will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────

export default function AiPage() {
  const [nextActionResults, setNextActionResults] = useState<NextActionResult[]>([]);

  const nextActionMutation = useMutation({
    mutationFn: () => apiClient.post<NextActionResult | NextActionResult[]>('/ai/next-action', {}),
    onSuccess: (data) => {
      const results = Array.isArray(data) ? data : [data];
      setNextActionResults(results);
      toast.success('AI recommendations ready');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const upsellMutation = useMutation({
    mutationFn: () => apiClient.post('/ai/upsell', {}),
    onSuccess: () => toast.success('Upsell analysis complete'),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Brain className="h-7 w-7 text-brand-600" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Engine</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          AI-powered recommendations, email generation, and upsell detection
        </p>
      </div>

      {/* AI Actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">AI Actions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            title="Next Best Action"
            description="Get AI-powered recommendations for your highest-priority actions across all leads and clients"
            icon={Target}
            color="bg-brand-600"
            onClick={() => nextActionMutation.mutate()}
            loading={nextActionMutation.isPending}
          />
          <ActionCard
            title="Upsell Detection"
            description="Scan your client base for upsell and cross-sell opportunities"
            icon={TrendingUp}
            color="bg-green-600"
            onClick={() => upsellMutation.mutate()}
            loading={upsellMutation.isPending}
          />
          <ActionCard
            title="Lead Scoring"
            description="Run batch AI scoring on unscored leads to prioritize outreach"
            icon={BarChart3}
            color="bg-purple-600"
            onClick={() => toast.info('Navigate to Leads page to score leads')}
          />
        </div>
      </div>

      {/* Next Action Results */}
      {nextActionResults.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recommended Actions</h2>
          <div className="mt-4 space-y-3">
            {nextActionResults.map((r, i) => (
              <ResultCard key={i} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* Email Generator */}
      <EmailGeneratorPanel />
    </div>
  );
}
