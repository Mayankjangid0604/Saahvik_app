import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api, { unwrap } from '@/lib/api';
import { formatRupees, generateIdempotencyKey } from '@/lib/format';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import type { Resident, OccupancyData, ResidentStatus } from '@/lib/types';

const statusBadge: Record<ResidentStatus, string> = {
  active: 'bg-green-100 text-green-700',
  vacated: 'bg-red-100 text-red-700',
  transferred: 'bg-yellow-100 text-yellow-700',
};

type Tab = 'guardians' | 'fees' | 'payments' | 'dues';

export default function ResidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('guardians');
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Modals
  const [showAssignBed, setShowAssignBed] = useState(false);
  const [showVacate, setShowVacate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState('');
  const [vacateDate, setVacateDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: resident, isLoading, isError, refetch } = useQuery({
    queryKey: ['resident', id],
    queryFn: async () => unwrap<Resident>(await api.get(`/residents/${id}`)),
    enabled: !!id,
  });

  const occupancyQuery = useQuery({
    queryKey: ['occupancy'],
    queryFn: async () =>
      unwrap<OccupancyData>(await api.get('/properties/me/occupancy')),
    enabled: showAssignBed || showTransfer,
  });

  const vacantBeds = (occupancyQuery.data?.rooms ?? []).flatMap((room) =>
    room.beds
      .filter((b) => b.status === 'vacant')
      .map((b) => ({
        id: b.id,
        label: `${room.wingName ? room.wingName + ' - ' : ''}Room ${room.roomNumber} / ${b.bedLabel}`,
      })),
  );

  const invalidateResident = () => {
    queryClient.invalidateQueries({ queryKey: ['resident', id] });
    queryClient.invalidateQueries({ queryKey: ['residents'] });
  };

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await api.patch(`/residents/${id}`, body);
    },
    onSuccess: () => {
      toast.success('Updated successfully');
      setEditField(null);
      invalidateResident();
    },
    onError: () => toast.error('Failed to update'),
  });

  const assignBedMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        `/residents/${id}/assign-bed`,
        { bedId: selectedBedId },
        { headers: { 'Idempotency-Key': generateIdempotencyKey() } },
      );
    },
    onSuccess: () => {
      toast.success('Bed assigned successfully');
      setShowAssignBed(false);
      setSelectedBedId('');
      invalidateResident();
      queryClient.invalidateQueries({ queryKey: ['occupancy'] });
    },
    onError: () => toast.error('Failed to assign bed'),
  });

  const vacateMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        `/residents/${id}/vacate`,
        { vacateDate },
        { headers: { 'Idempotency-Key': generateIdempotencyKey() } },
      );
    },
    onSuccess: () => {
      toast.success('Resident vacated successfully');
      setShowVacate(false);
      invalidateResident();
      queryClient.invalidateQueries({ queryKey: ['occupancy'] });
    },
    onError: () => toast.error('Failed to vacate resident'),
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        `/residents/${id}/transfer`,
        { newBedId: selectedBedId },
        { headers: { 'Idempotency-Key': generateIdempotencyKey() } },
      );
    },
    onSuccess: () => {
      toast.success('Resident transferred successfully');
      setShowTransfer(false);
      setSelectedBedId('');
      invalidateResident();
      queryClient.invalidateQueries({ queryKey: ['occupancy'] });
    },
    onError: () => toast.error('Failed to transfer resident'),
  });

  const startEdit = (field: string, currentValue: string) => {
    setEditField(field);
    setEditValue(currentValue);
  };

  const saveEdit = () => {
    if (editField) {
      patchMutation.mutate({ [editField]: editValue.trim() });
    }
  };

  if (isLoading) return <PageLoader />;
  if (isError || !resident)
    return <ErrorMessage message="Failed to load resident" onRetry={refetch} />;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'guardians', label: 'Guardians' },
    { key: 'fees', label: 'Fee Structures' },
    { key: 'payments', label: 'Payments' },
    { key: 'dues', label: 'Dues' },
  ];

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/residents')}
            className="text-sm text-blue-600 hover:text-blue-700 mb-1"
          >
            &larr; Back to Residents
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {resident.fullName}
          </h1>
        </div>
        {resident.status === 'active' && (
          <div className="flex items-center gap-2">
            {!resident.bedId && (
              <button
                onClick={() => setShowAssignBed(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Assign Bed
              </button>
            )}
            {resident.bedId && (
              <button
                onClick={() => setShowTransfer(true)}
                className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              >
                Transfer
              </button>
            )}
            <button
              onClick={() => setShowVacate(true)}
              className="rounded-lg border border-red-500 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Vacate
            </button>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Full Name - editable */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Full Name
            </label>
            {editField === 'fullName' ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={inputClass}
                  autoFocus
                />
                <button
                  onClick={saveEdit}
                  disabled={patchMutation.isPending}
                  className="text-sm text-blue-600 font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditField(null)}
                  className="text-sm text-gray-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p
                className="text-sm text-gray-900 cursor-pointer hover:text-blue-600"
                onClick={() => startEdit('fullName', resident.fullName)}
              >
                {resident.fullName}
              </p>
            )}
          </div>

          {/* Phone - editable */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Phone
            </label>
            {editField === 'phone' ? (
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={inputClass}
                  autoFocus
                />
                <button
                  onClick={saveEdit}
                  disabled={patchMutation.isPending}
                  className="text-sm text-blue-600 font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditField(null)}
                  className="text-sm text-gray-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p
                className="text-sm text-gray-900 cursor-pointer hover:text-blue-600"
                onClick={() => startEdit('phone', resident.phone ?? '')}
              >
                {resident.phone ?? '-'}
              </p>
            )}
          </div>

          {/* Email - editable */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Email
            </label>
            {editField === 'email' ? (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={inputClass}
                  autoFocus
                />
                <button
                  onClick={saveEdit}
                  disabled={patchMutation.isPending}
                  className="text-sm text-blue-600 font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditField(null)}
                  className="text-sm text-gray-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p
                className="text-sm text-gray-900 cursor-pointer hover:text-blue-600"
                onClick={() => startEdit('email', resident.email ?? '')}
              >
                {resident.email ?? '-'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Status
            </label>
            <span
              className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusBadge[resident.status]}`}
            >
              {resident.status}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Admission Date
            </label>
            <p className="text-sm text-gray-900">
              {format(new Date(resident.admissionDate), 'dd MMM yyyy')}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Room / Bed
            </label>
            <p className="text-sm text-gray-900">
              {resident.bed
                ? `${resident.bed.room?.roomNumber ?? '-'} / ${resident.bed.bedLabel}`
                : 'Unassigned'}
            </p>
          </div>

          {resident.vacateDate && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Vacate Date
              </label>
              <p className="text-sm text-gray-900">
                {format(new Date(resident.vacateDate), 'dd MMM yyyy')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {activeTab === 'guardians' && (
          <div>
            {(resident.guardianLinks ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No guardians on file</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {resident.guardianLinks!.map((gl) => (
                  <div key={gl.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {gl.guardian.fullName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {gl.relationship} &middot; {gl.guardian.phone}
                          {gl.guardian.email && ` · ${gl.guardian.email}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'fees' && (
          <div className="overflow-x-auto">
            {(resident.feeStructures ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No fee structures</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Monthly Rent</th>
                    <th className="pb-2 font-medium">Effective From</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resident.feeStructures!.map((fs) => (
                    <tr key={fs.id}>
                      <td className="py-2 font-medium text-gray-900">
                        {formatRupees(fs.monthlyRentPaisa)}
                      </td>
                      <td className="py-2 text-gray-600">
                        {format(new Date(fs.effectiveFrom), 'dd MMM yyyy')}
                      </td>
                      <td className="py-2 text-gray-500">
                        {format(new Date(fs.createdAt), 'dd MMM yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="overflow-x-auto">
            {(resident.payments ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No payments recorded</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Method</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resident.payments!.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 font-medium text-gray-900">
                        {formatRupees(p.amountPaisa)}
                      </td>
                      <td className="py-2 text-gray-600 capitalize">
                        {p.method.replace('_', ' ')}
                      </td>
                      <td className="py-2 text-gray-500">
                        {format(new Date(p.paidOn), 'dd MMM yyyy')}
                      </td>
                      <td className="py-2 text-gray-500 truncate max-w-[200px]">
                        {p.notes ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'dues' && (
          <div className="overflow-x-auto">
            {(resident.dues ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No outstanding dues</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Amount Due</th>
                    <th className="pb-2 font-medium">Due Since</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resident.dues!.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2 font-medium text-gray-900">
                        {formatRupees(d.amountDuePaisa)}
                      </td>
                      <td className="py-2 text-gray-500">
                        {format(new Date(d.dueSince), 'dd MMM yyyy')}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                            d.settled
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {d.settled ? 'Settled' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Assign Bed Modal */}
      {showAssignBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign Bed
            </h3>
            {occupancyQuery.isLoading ? (
              <PageLoader />
            ) : (
              <>
                <select
                  value={selectedBedId}
                  onChange={(e) => setSelectedBedId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a bed</option>
                  {vacantBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
                {vacantBeds.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500">
                    No vacant beds available
                  </p>
                )}
              </>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAssignBed(false);
                  setSelectedBedId('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => assignBedMutation.mutate()}
                disabled={!selectedBedId || assignBedMutation.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assignBedMutation.isPending ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vacate Confirmation Modal */}
      {showVacate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Vacate Resident
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to vacate{' '}
              <strong>{resident.fullName}</strong>? This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vacate Date
              </label>
              <input
                type="date"
                value={vacateDate}
                onChange={(e) => setVacateDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowVacate(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => vacateMutation.mutate()}
                disabled={vacateMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {vacateMutation.isPending ? 'Processing...' : 'Confirm Vacate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Transfer Resident
            </h3>
            {occupancyQuery.isLoading ? (
              <PageLoader />
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Bed
                </label>
                <select
                  value={selectedBedId}
                  onChange={(e) => setSelectedBedId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a bed</option>
                  {vacantBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
                {vacantBeds.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500">
                    No vacant beds available
                  </p>
                )}
              </>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTransfer(false);
                  setSelectedBedId('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => transferMutation.mutate()}
                disabled={!selectedBedId || transferMutation.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {transferMutation.isPending ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
