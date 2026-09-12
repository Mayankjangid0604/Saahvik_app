import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import api, { unwrap } from '@/lib/api';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import Pagination from '@/components/common/Pagination';
import type { PaginatedResult, Resident, ResidentStatus } from '@/lib/types';

const statusBadge: Record<ResidentStatus, string> = {
  active: 'bg-green-100 text-green-700',
  vacated: 'bg-red-100 text-red-700',
  transferred: 'bg-yellow-100 text-yellow-700',
};

export default function ResidentListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['residents', page, pageSize, statusFilter, search],
    queryFn: async () =>
      unwrap<PaginatedResult<Resident>>(
        await api.get('/residents', {
          params: {
            page,
            pageSize,
            ...(statusFilter !== 'all' && { status: statusFilter }),
            ...(search.trim() && { search: search.trim() }),
          },
        }),
      ),
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorMessage message="Failed to load residents" onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Residents</h1>
        <Link
          to="/residents/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Resident
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="vacated">Vacated</option>
          <option value="transferred">Transferred</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Room / Bed</th>
                <th className="px-4 py-3 font-medium">Admission Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.items ?? []).map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/residents/${r.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.fullName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.phone ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusBadge[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.bed
                      ? `${r.bed.room?.roomNumber ?? '-'} / ${r.bed.bedLabel}`
                      : 'Unassigned'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {format(new Date(r.admissionDate), 'dd MMM yyyy')}
                  </td>
                </tr>
              ))}
              {!data?.items.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    No residents found
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
