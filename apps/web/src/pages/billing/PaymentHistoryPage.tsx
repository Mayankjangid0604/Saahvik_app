import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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

// The API only exposes payments per-resident (GET /residents/:id/payments) —
// there is no org-wide payment ledger endpoint per the API spec. This page
// requires picking a resident first, then shows that resident's history.
export default function PaymentHistoryPage() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [residentId, setResidentId] = useState(searchParams.get('residentId') ?? '');

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
    queryKey: ['payments', residentId, page],
    queryFn: async () =>
      unwrap<PaginatedResult<Payment>>(
        await api.get(`/residents/${residentId}/payments`, {
          params: { page, pageSize: PAGE_SIZE },
        }),
      ),
    enabled: !!residentId,
  });

  const handleDownloadReceipt = async (paymentId: string) => {
    try {
      const { receiptPdfKey } = unwrap<{ receiptPdfKey: string }>(
        await api.get(`/residents/${residentId}/payments/${paymentId}/receipt`),
      );
      const response = await api.get(`/files/${receiptPdfKey}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error('Failed to download receipt');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>

      {/* Resident selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Resident
        </label>
        <select
          value={residentId}
          onChange={(e) => {
            setResidentId(e.target.value);
            setPage(1);
          }}
          className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
        >
          <option value="">Select a resident...</option>
          {residents?.items.map((r) => (
            <option key={r.id} value={r.id}>
              {r.fullName}
            </option>
          ))}
        </select>
      </div>

      {!residentId && (
        <div className="text-center text-gray-400 py-12">
          Select a resident above to view their payment history.
        </div>
      )}

      {residentId && isLoading && <PageLoader />}
      {residentId && isError && (
        <ErrorMessage message="Failed to load payments" onRetry={refetch} />
      )}

      {residentId && data && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
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
                      colSpan={4}
                      className="px-5 py-12 text-center text-gray-400"
                    >
                      No payments found for this resident.
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
      )}
    </div>
  );
}
