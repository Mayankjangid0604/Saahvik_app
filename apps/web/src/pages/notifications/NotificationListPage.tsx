import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  PlusIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import api, { unwrap } from '@/lib/api';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import Pagination from '@/components/common/Pagination';
import type {
  PaginatedResult,
  Notification,
  NotificationChannel,
  NotificationStatus,
} from '@/lib/types';

const channelBadge: Record<NotificationChannel, { label: string; className: string }> = {
  email: { label: 'Email', className: 'bg-blue-100 text-blue-700' },
  sms: { label: 'SMS', className: 'bg-purple-100 text-purple-700' },
  whatsapp: { label: 'WhatsApp', className: 'bg-green-100 text-green-700' },
  push: { label: 'Push', className: 'bg-orange-100 text-orange-700' },
};

const statusBadge: Record<NotificationStatus, { label: string; className: string }> = {
  queued: { label: 'Queued', className: 'bg-yellow-100 text-yellow-700' },
  sent: { label: 'Sent', className: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
  pending_provider_config: {
    label: 'Pending Config',
    className: 'bg-gray-100 text-gray-700',
  },
};

export default function NotificationListPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', page, pageSize],
    queryFn: async () =>
      unwrap<PaginatedResult<Notification>>(
        await api.get('/notifications', { params: { page, pageSize } }),
      ),
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return (
      <ErrorMessage message="Failed to load notifications" onRetry={refetch} />
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <div className="flex gap-2">
          <Link
            to="/notifications/templates"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <DocumentTextIcon className="h-4 w-4" />
            Templates
          </Link>
          <Link
            to="/notifications/compose"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Compose
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.items ?? []).map((n) => {
                const ch = channelBadge[n.channel];
                const st = statusBadge[n.status];
                const recipient =
                  n.recipientEmail ?? n.recipientPhone ?? '-';
                return (
                  <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${ch.className}`}
                      >
                        {ch.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{recipient}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {n.subject ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${st.className}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {n.sentAt
                        ? format(new Date(n.sentAt), 'dd MMM yyyy HH:mm')
                        : n.createdAt
                          ? format(new Date(n.createdAt), 'dd MMM yyyy HH:mm')
                          : '-'}
                    </td>
                  </tr>
                );
              })}
              {!data?.items.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No notifications found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
