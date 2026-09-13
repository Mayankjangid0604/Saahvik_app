import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import api, { unwrap } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import Pagination from '@/components/common/Pagination';
import type { PaginatedResult, AuditLog } from '@/lib/types';

const ENTITY_TYPES = [
  'all',
  'resident',
  'payment',
  'bed',
  'room',
  'property',
  'organization',
  'notification',
  'user',
] as const;

export default function AuditLogPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [entityType, setEntityType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isOwner = user?.role === 'owner';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', page, pageSize, entityType, dateFrom, dateTo],
    queryFn: async () =>
      unwrap<PaginatedResult<AuditLog>>(
        await api.get('/audit-logs', {
          params: {
            page,
            pageSize,
            ...(entityType !== 'all' && { entityType }),
            ...(dateFrom && { dateFrom }),
            ...(dateTo && { dateTo }),
          },
        }),
      ),
    enabled: isOwner,
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Only owners can view audit logs
  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-gray-600">
          Only organization owners can view audit logs.
        </p>
      </div>
    );
  }

  if (isLoading) return <PageLoader />;
  if (isError)
    return (
      <ErrorMessage message="Failed to load audit logs" onRetry={refetch} />
    );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'all' ? 'All Entities' : t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          placeholder="From"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          placeholder="To"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {(entityType !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setEntityType('all');
              setDateFrom('');
              setDateTo('');
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="px-4 py-3 font-medium w-8"></th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.items ?? []).map((log) => (
                <TableRow
                  key={log.id}
                  log={log}
                  isExpanded={expandedId === log.id}
                  onToggle={() => toggleExpand(log.id)}
                />
              ))}
              {!data?.items.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No audit logs found
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

function TableRow({
  log,
  isExpanded,
  onToggle,
}: {
  log: AuditLog;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasMetadata =
    log.metadata && Object.keys(log.metadata).length > 0;
  const ExpandIcon = isExpanded ? ChevronUpIcon : ChevronDownIcon;

  const actionColors: Record<string, string> = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
  };

  const actionKey = log.action.toLowerCase().includes('create')
    ? 'create'
    : log.action.toLowerCase().includes('delete')
      ? 'delete'
      : 'update';

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          {hasMetadata && (
            <button
              onClick={onToggle}
              className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ExpandIcon className="h-4 w-4" />
            </button>
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${actionColors[actionKey] ?? 'bg-gray-100 text-gray-700'}`}
          >
            {log.action}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-900">
          <span className="font-medium">{log.entityType}</span>
          {log.entityId && (
            <span className="text-gray-400 ml-1 text-xs">
              {log.entityId.slice(0, 8)}...
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-gray-600">
          {log.user?.name ?? log.userId ?? 'System'}
        </td>
        <td className="px-4 py-3 text-gray-500">
          {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm:ss')}
        </td>
      </tr>
      {isExpanded && hasMetadata && (
        <tr>
          <td colSpan={5} className="px-4 py-3 bg-gray-50">
            <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap rounded-lg bg-gray-100 p-3">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
