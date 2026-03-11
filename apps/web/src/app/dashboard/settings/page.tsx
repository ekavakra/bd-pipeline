'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { cn } from '@/lib/utils';
import {
  User,
  Users,
  Key,
  Bell as BellIcon,
  Loader2,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

// ── Constants ────────────────────────────────

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
] as const;

type TabId = typeof TABS[number]['id'];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  BD_MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  ONBOARDING_MANAGER: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  PARTNER: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

// ── Components ───────────────────────────────

function ProfileTab() {
  const qc = useQueryClient();
  const storeUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.accessToken);

  const { data: profile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => apiClient.get<UserProfile>('/users/me'),
  });

  const currentUser = profile ?? storeUser;

  // ── Name edit ──
  const [name, setName] = useState('');
  const [nameEditing, setNameEditing] = useState(false);

  const nameMutation = useMutation({
    mutationFn: (newName: string) => apiClient.patch<UserProfile>('/users/me', { name: newName }),
    onSuccess: (data) => {
      toast.success('Name updated');
      setNameEditing(false);
      // update Zustand store so header reflects it immediately
      if (token && data) setAuth(token, { id: data.id, name: data.name, email: data.email, role: data.role });
      qc.invalidateQueries({ queryKey: ['user-profile'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to update name'),
  });

  // ── Password change ──
  const [showPwForm, setShowPwForm] = useState(false);
  const [pw, setPw] = useState({ current: '', new_: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);

  const pwMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/users/me/password', {
        currentPassword: pw.current,
        newPassword: pw.new_,
      }),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setShowPwForm(false);
      setPw({ current: '', new_: '', confirm: '' });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to change password'),
  });

  const pwValid = pw.current.length >= 8 && pw.new_.length >= 8 && pw.new_ === pw.confirm && /[A-Z]/.test(pw.new_) && /\d/.test(pw.new_);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Profile Information</h3>
        <p className="text-sm text-slate-500">Your account details and preferences</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white">
            {currentUser?.name?.charAt(0) ?? '?'}
          </div>
          <div>
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
              {currentUser?.name ?? 'Unknown'}
            </h4>
            <p className="text-sm text-slate-500">{currentUser?.email ?? ''}</p>
            <span className={cn('mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', ROLE_COLORS[currentUser?.role ?? ''] ?? 'bg-slate-100 text-slate-700')}>
              {currentUser?.role?.replace(/_/g, ' ') ?? ''}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
            {nameEditing ? (
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  autoFocus
                />
                <button
                  onClick={() => nameMutation.mutate(name)}
                  disabled={!name.trim() || nameMutation.isPending}
                  className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {nameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setNameEditing(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={currentUser?.name ?? ''}
                  disabled
                  className="block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                <button
                  onClick={() => {
                    setName(currentUser?.name ?? '');
                    setNameEditing(true);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-600"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              defaultValue={currentUser?.email ?? ''}
              disabled
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
        </div>

        {/* Security / Password */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Security</h4>

          {!showPwForm ? (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
              <Key className="h-5 w-5 text-slate-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">Password</p>
                <p className="text-xs text-slate-500">Change your account password</p>
              </div>
              <button
                onClick={() => setShowPwForm(true)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium dark:border-slate-600"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Current Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pw.current}
                    onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw.new_}
                  onChange={(e) => setPw((p) => ({ ...p, new_: e.target.value }))}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                <p className="mt-1 text-xs text-slate-400">Min 8 chars, 1 uppercase, 1 number</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Confirm New Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw.confirm}
                  onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                {pw.confirm && pw.new_ !== pw.confirm && (
                  <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => pwMutation.mutate()}
                  disabled={!pwValid || pwMutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {pwMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Change Password
                </button>
                <button
                  onClick={() => {
                    setShowPwForm(false);
                    setPw({ current: '', new_: '', confirm: '' });
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamTab() {
  const { data: users, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => apiClient.get<{ users: UserProfile[] }>('/users').catch(() => ({ users: [] })),
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Team Members</h3>
        <p className="text-sm text-slate-500">Manage your team and their roles</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
            <tr>
              <th className="px-6 py-3 font-medium text-slate-500">Name</th>
              <th className="px-6 py-3 font-medium text-slate-500">Email</th>
              <th className="px-6 py-3 font-medium text-slate-500">Role</th>
              <th className="px-6 py-3 font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">Loading...</td>
              </tr>
            ) : (users?.users?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                  Only admins can view team members
                </td>
              </tr>
            ) : (
              users?.users?.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                        {user.name.charAt(0)}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', ROLE_COLORS[user.role] ?? 'bg-slate-100')}>
                      {user.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', user.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300')}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Notification Preferences</h3>
        <p className="text-sm text-slate-500">Choose how you want to be notified</p>
      </div>

      <div className="space-y-3">
        {[
          { label: 'SLA Alerts', description: 'Get notified when an SLA is at risk or breached', enabled: true },
          { label: 'New Lead Alerts', description: 'Notifications for new AI-discovered leads', enabled: true },
          { label: 'Stage Changes', description: 'When a client advances in the onboarding pipeline', enabled: true },
          { label: 'Approval Requests', description: 'Pitches and proposals pending your approval', enabled: true },
          { label: 'Upsell Signals', description: 'AI-detected upsell opportunities', enabled: false },
          { label: 'Meeting Reminders', description: 'Upcoming meeting reminders', enabled: true },
        ].map((pref) => (
          <div
            key={pref.label}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{pref.label}</p>
              <p className="text-xs text-slate-500">{pref.description}</p>
            </div>
            <button
              onClick={() => toast.info('Notification preferences coming soon')}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                pref.enabled ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600',
              )}
            >
              <span
                className={cn(
                  'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm',
                  pref.enabled && 'translate-x-5',
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account and preferences</p>
      </div>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row">
        {/* Sidebar tabs */}
        <nav className="flex gap-1 lg:w-48 lg:flex-col">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'team' && <TeamTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
        </div>
      </div>
    </div>
  );
}
