'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate, cn } from '@/lib/utils';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  ArrowRightCircle,
  Users,
  TrendingUp,
  Calendar,
  Mail,
  Check,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  referenceType: string | null;
  referenceId: string | null;
  channel: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ── Constants ────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  SLA_ALERT: { icon: AlertTriangle, color: 'text-red-500 bg-red-100 dark:bg-red-900' },
  APPROVAL_REQUEST: { icon: CheckCircle2, color: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900' },
  STAGE_CHANGE: { icon: ArrowRightCircle, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900' },
  NEW_LEAD: { icon: Users, color: 'text-green-500 bg-green-100 dark:bg-green-900' },
  UPSELL_SIGNAL: { icon: TrendingUp, color: 'text-purple-500 bg-purple-100 dark:bg-purple-900' },
  MEETING_REMINDER: { icon: Calendar, color: 'text-orange-500 bg-orange-100 dark:bg-orange-900' },
  EMAIL_APPROVAL: { icon: Mail, color: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900' },
};

// ── Main Page ────────────────────────────────

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiClient.get<NotificationsResponse>('/notifications?limit=50'),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'} &middot; {data?.meta?.total ?? 0} total
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="mt-6 space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-white dark:bg-slate-900" />
          ))
        ) : notifications.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center dark:bg-slate-900">
            <Bell className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm text-slate-500">No notifications yet</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const typeConfig = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG['STAGE_CHANGE'];
            const Icon = typeConfig.icon;

            return (
              <div
                key={notification.id}
                className={cn(
                  'flex items-start gap-4 rounded-xl bg-white p-4 shadow-sm transition-all dark:bg-slate-900',
                  !notification.isRead && 'border-l-4 border-brand-500 bg-brand-50/30 dark:bg-brand-950/20',
                )}
              >
                <div className={cn('rounded-lg p-2', typeConfig.color)}>
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={cn('text-sm', !notification.isRead ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300')}>
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">{notification.body}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDate(notification.createdAt)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                      {notification.type.replace(/_/g, ' ')}
                    </span>
                    {!notification.isRead && (
                      <button
                        onClick={() => markReadMutation.mutate(notification.id)}
                        className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
                      >
                        <Check className="h-3 w-3" />
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
