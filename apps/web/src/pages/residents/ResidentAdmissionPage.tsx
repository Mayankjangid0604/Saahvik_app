import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api, { unwrap } from '@/lib/api';
import { generateIdempotencyKey } from '@/lib/format';
import { PageLoader } from '@/components/common/LoadingSpinner';
import type { OccupancyData } from '@/lib/types';

interface GuardianInput {
  fullName: string;
  phone: string;
  email: string;
  relationship: string;
}

const emptyGuardian = (): GuardianInput => ({
  fullName: '',
  phone: '',
  email: '',
  relationship: '',
});

export default function ResidentAdmissionPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [admissionDate, setAdmissionDate] = useState(
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [bedId, setBedId] = useState('');
  const [guardians, setGuardians] = useState<GuardianInput[]>([emptyGuardian()]);

  const occupancyQuery = useQuery({
    queryKey: ['occupancy'],
    queryFn: async () =>
      unwrap<OccupancyData>(await api.get('/properties/me/occupancy')),
  });

  const vacantBeds = (occupancyQuery.data?.rooms ?? []).flatMap((room) =>
    room.beds
      .filter((b) => b.status === 'vacant')
      .map((b) => ({
        id: b.id,
        label: `${room.wingName ? room.wingName + ' - ' : ''}Room ${room.roomNumber} / ${b.bedLabel}`,
      })),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        ...(email.trim() && { email: email.trim() }),
        admissionDate,
        ...(bedId && { bedId }),
        guardians: guardians
          .filter((g) => g.fullName.trim() && g.phone.trim())
          .map((g) => ({
            fullName: g.fullName.trim(),
            phone: g.phone.trim(),
            ...(g.email.trim() && { email: g.email.trim() }),
            relationship: g.relationship.trim() || 'other',
          })),
      };
      const res = await api.post('/residents', body, {
        headers: { 'Idempotency-Key': generateIdempotencyKey() },
      });
      return unwrap<{ id: string }>(res);
    },
    onSuccess: (data) => {
      toast.success('Resident admitted successfully');
      navigate(`/residents/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.error?.message ?? 'Failed to admit resident',
      );
    },
  });

  const updateGuardian = (
    index: number,
    field: keyof GuardianInput,
    value: string,
  ) => {
    setGuardians((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)),
    );
  };

  const removeGuardian = (index: number) => {
    setGuardians((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !admissionDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    mutation.mutate();
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">New Admission</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Resident Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                required
                disabled={mutation.isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                required
                disabled={mutation.isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                disabled={mutation.isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admission Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
                className={inputClass}
                required
                disabled={mutation.isPending}
              />
            </div>
          </div>
        </div>

        {/* Bed Assignment */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Bed Assignment (Optional)
          </h2>
          {occupancyQuery.isLoading ? (
            <PageLoader />
          ) : (
            <select
              value={bedId}
              onChange={(e) => setBedId(e.target.value)}
              className={inputClass}
              disabled={mutation.isPending}
            >
              <option value="">No bed assigned</option>
              {vacantBeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          )}
          {!occupancyQuery.isLoading && vacantBeds.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              No vacant beds available
            </p>
          )}
        </div>

        {/* Guardians */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Guardians</h2>
            <button
              type="button"
              onClick={() => setGuardians((prev) => [...prev, emptyGuardian()])}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              disabled={mutation.isPending}
            >
              <PlusIcon className="h-4 w-4" />
              Add Guardian
            </button>
          </div>
          <div className="space-y-4">
            {guardians.map((g, i) => (
              <div
                key={i}
                className="rounded-lg border border-gray-100 bg-gray-50 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">
                    Guardian {i + 1}
                  </span>
                  {guardians.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGuardian(i)}
                      className="text-red-500 hover:text-red-600"
                      disabled={mutation.isPending}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={g.fullName}
                      onChange={(e) =>
                        updateGuardian(i, 'fullName', e.target.value)
                      }
                      className={inputClass}
                      disabled={mutation.isPending}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={g.phone}
                      onChange={(e) =>
                        updateGuardian(i, 'phone', e.target.value)
                      }
                      className={inputClass}
                      disabled={mutation.isPending}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={g.email}
                      onChange={(e) =>
                        updateGuardian(i, 'email', e.target.value)
                      }
                      className={inputClass}
                      disabled={mutation.isPending}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Relationship
                    </label>
                    <select
                      value={g.relationship}
                      onChange={(e) =>
                        updateGuardian(i, 'relationship', e.target.value)
                      }
                      className={inputClass}
                      disabled={mutation.isPending}
                    >
                      <option value="">Select</option>
                      <option value="parent">Parent</option>
                      <option value="sibling">Sibling</option>
                      <option value="spouse">Spouse</option>
                      <option value="relative">Relative</option>
                      <option value="friend">Friend</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/residents')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mutation.isPending ? 'Admitting...' : 'Admit Resident'}
          </button>
        </div>
      </form>
    </div>
  );
}
