import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api, { unwrap } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import Pagination from '@/components/common/Pagination';
import type {
  Payment,
  PaymentMethod,
  PaginatedResult,
  Resident,
} from '@/lib/types';

const PAGE_SIZE = 20;

const METHOD_BADGES: Record<PaymentMethod, { label: string; className: string }> = {
  cash: {
    label: 'Cash',
    className: 'bg-green-100 text-green-800',
  },
  upi: {
    label: 'UPI',
    className: 'bg-purple-100 text-purple-800',
  },
  bank_transfer: {
    label: 'Bank Transfer',
    className: 'bg-blue-100 text-blue-800',
  },
  razorpay: {
    label: 'Razorpay',
    className: 'bg-indigo-100 text-indigo-800',
  },
};

export default function PaymentHistoryPage() {
  const [page, setPage] = useState(1);
  const [residentFilter, setResidentFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const { data: residents } = useQuery({
    queryKey: ['residents-active'],
    queryFn: async () =>
      unwrap<PaginatedResult<Resident>>(
        await api.get('/residents', {
          params: { status: 'active', pageSize: 500 },
        }),
      ),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['payments', page, residentFilter, methodFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        pageSize: PAGE_SIZE,
      };
      if (residentFilter) params.residentId = residentFilter;
      if (methodFilter) params.method = methodFilter;
      return unwrap<PaginatedResult<Payment>>(
        await api.get('/billing/payments', { params }),
      );
    },
  });

  const handleDownloadReceipt = async (paymentId: string) => {
    try {
      const response = await api.get(`/billing/payments/${paymentId}/receipt`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error('Failed to download receipt');
    }
  };

  if (isLoading) return <PageLoader />;
  if (isError)
    return (
      <ErrorMessage message="Failed to load payments" onRetry={refetch} />
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Resident
            </label>
            <select
              value={residentFilter}
              onChange={(e) => {
                setResidentFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
            >
              <option value="">All Residents</option>
              {residents?.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Payment Method
            </label>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
            >
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="razorpay">Razorpay</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-5 py-3 font-medium">Resident</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.items.map((payment) => {
                const badge = METHOD_BADGES[payment.method];
                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900 font-medium">
                      {payment.resident?.fullName ?? 'Unknown'}
                    </td>
                    <td className="px-5 py-3 text-gray-900">
                      {formatRupees(payment.amountPaisa)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {format(new Date(payment.paidOn), 'dd MMM yyyy')}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleDownloadReceipt(payment.id)}
                        className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                );
              })}
              {data.items.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-gray-400"
                  >
                    No payments found.
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
