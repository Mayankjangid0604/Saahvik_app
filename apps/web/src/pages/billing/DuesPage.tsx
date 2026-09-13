import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import api, { unwrap } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import Pagination from '@/components/common/Pagination';
import type { Dues, PaginatedResult } from '@/lib/types';

const PAGE_SIZE = 20;

export default function DuesPage() {
  const [page, setPage] = useState(1);
  const [showSettled, setShowSettled] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dues', page, showSettled],
    queryFn: async () =>
      unwrap<PaginatedResult<Dues>>(
        await api.get('/dues', {
          params: { page, pageSize: PAGE_SIZE, settled: showSettled },
        }),
      ),
  });

  const totalOutstanding = data?.items
    .filter((d) => !d.settled)
    .reduce((sum, d) => sum + BigInt(d.amountDuePaisa), 0n) ?? 0n;

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorMessage message="Failed to load dues" onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Outstanding Dues</h1>
        <Link
          to="/billing/record-payment"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          Record Payment
        </Link>
      </div>

      {!showSettled && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Outstanding</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatRupees(totalOutstanding.toString())}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Dues</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showSettled}
              onChange={(e) => {
                setShowSettled(e.target.checked);
                setPage(1);
              }}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Show settled
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-5 py-3 font-medium">Resident</th>
                <th className="px-5 py-3 font-medium">Amount Due</th>
                <th className="px-5 py-3 font-medium">Due Since</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.items.map((due) => (
                <tr key={due.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-900 font-medium">
                    {due.resident?.fullName ?? 'Unknown'}
                  </td>
                  <td className="px-5 py-3 text-gray-900">
                    {formatRupees(due.amountDuePaisa)}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {format(new Date(due.dueSince), 'dd MMM yyyy')}
                  </td>
                  <td className="px-5 py-3">
                    {due.settled ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Settled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {!due.settled && (
                      <Link
                        to={`/billing/record-payment?residentId=${due.residentId}`}
                        className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        Record Payment
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-gray-400"
                  >
                    {showSettled
                      ? 'No settled dues found.'
                      : 'No outstanding dues. All clear!'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
