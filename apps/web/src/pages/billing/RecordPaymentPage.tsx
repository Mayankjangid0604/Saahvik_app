import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api, { unwrap } from '@/lib/api';
import { generateIdempotencyKey, rupeesToPaisa } from '@/lib/format';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import type { Resident, PaginatedResult, PaymentMethod } from '@/lib/types';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'razorpay', label: 'Razorpay' },
];

export default function RecordPaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedResidentId = searchParams.get('residentId') ?? '';

  const [residentId, setResidentId] = useState(preselectedResidentId);
  const [residentSearch, setResidentSearch] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidOn, setPaidOn] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);

  const {
    data: residents,
    isLoading: residentsLoading,
    isError: residentsError,
    refetch: refetchResidents,
  } = useQuery({
    queryKey: ['residents-active'],
    queryFn: async () =>
      unwrap<PaginatedResult<Resident>>(
        await api.get('/residents', {
          params: { status: 'active', pageSize: 500 },
        }),
      ),
  });

  // If preselected resident ID, set search to their name once loaded
  useEffect(() => {
    if (preselectedResidentId && residents) {
      const found = residents.items.find((r) => r.id === preselectedResidentId);
      if (found) {
        setResidentSearch(found.fullName);
      }
    }
  }, [preselectedResidentId, residents]);

  const filteredResidents = residents?.items.filter((r) =>
    r.fullName.toLowerCase().includes(residentSearch.toLowerCase()),
  );

  const submitPayment = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(amountRupees);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount');
      if (!residentId) throw new Error('Select a resident');

      const response = await api.post(
        `/residents/${residentId}/payments`,
        {
          amountPaisa: String(rupeesToPaisa(amount)),
          method,
          paidOn,
          notes: notes.trim() || undefined,
        },
        {
          headers: { 'Idempotency-Key': generateIdempotencyKey() },
        },
      );
      return unwrap<{ id: string }>(response);
    },
    onSuccess: (data) => {
      toast.success('Payment recorded successfully');
      setLastPaymentId(data.id);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to record payment');
    },
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
      // Clean up after a short delay to allow the browser to open it
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error('Failed to download receipt');
    }
  };

  if (residentsLoading) return <PageLoader />;
  if (residentsError)
    return (
      <ErrorMessage
        message="Failed to load residents"
        onRetry={refetchResidents}
      />
    );

  // Success state
  if (lastPaymentId) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Payment Recorded
          </h2>
          <p className="text-gray-500 text-sm">
            The payment has been saved successfully.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleDownloadReceipt(lastPaymentId)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Download Receipt
            </button>
            <button
              onClick={() => navigate(`/residents/${residentId}`)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              View Resident Profile
            </button>
          </div>
          <button
            onClick={() => {
              setLastPaymentId(null);
              setResidentId('');
              setResidentSearch('');
              setAmountRupees('');
              setMethod('cash');
              setPaidOn(format(new Date(), 'yyyy-MM-dd'));
              setNotes('');
            }}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Record Another Payment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Record Payment</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Resident selector */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Resident
          </label>
          <div className="relative">
            <input
              type="text"
              value={residentSearch}
              onChange={(e) => {
                setResidentSearch(e.target.value);
                if (residentId) setResidentId('');
              }}
              placeholder="Search resident..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
            {residentSearch && !residentId && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredResidents?.length ? (
                  filteredResidents.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setResidentId(r.id);
                        setResidentSearch(r.fullName);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium text-gray-900">
                        {r.fullName}
                      </span>
                      {r.phone && (
                        <span className="text-gray-400 ml-2">{r.phone}</span>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-400">
                    No residents found
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Amount (in Rupees)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              &#8377;
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
          </div>
        </div>

        {/* Payment method */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Payment Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Payment Date
          </label>
          <input
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Notes{' '}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any additional details..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none resize-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={() => submitPayment.mutate()}
          disabled={!residentId || !amountRupees || submitPayment.isPending}
          className="w-full py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitPayment.isPending ? 'Recording...' : 'Record Payment'}
        </button>
      </div>
    </div>
  );
}
