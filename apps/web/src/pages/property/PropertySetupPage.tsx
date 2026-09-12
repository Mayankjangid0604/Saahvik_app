import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { unwrap } from '@/lib/api';
import toast from 'react-hot-toast';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { Property, Wing, Room } from '@/lib/types';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function PropertySetupPage() {
  const queryClient = useQueryClient();

  const propertyQuery = useQuery({
    queryKey: ['property'],
    queryFn: async () => unwrap<Property>(await api.get('/properties/me')),
  });

  const wingsQuery = useQuery({
    queryKey: ['wings'],
    queryFn: async () => unwrap<Wing[]>(await api.get('/properties/me/wings')),
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: async () =>
      unwrap<{ items: Room[]; total: number }>(
        await api.get('/properties/me/rooms', { params: { pageSize: 100 } }),
      ),
  });

  // --- Property form ---
  const [propForm, setPropForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
  });
  const [propFormInit, setPropFormInit] = useState(false);

  if (propertyQuery.data && !propFormInit) {
    setPropForm({
      name: propertyQuery.data.name || '',
      address: propertyQuery.data.address || '',
      city: propertyQuery.data.city || '',
      state: propertyQuery.data.state || '',
    });
    setPropFormInit(true);
  }

  const updatePropertyMut = useMutation({
    mutationFn: async (data: typeof propForm) => {
      return unwrap<Property>(await api.patch('/properties/me', data));
    },
    onSuccess: () => {
      toast.success('Property updated');
      queryClient.invalidateQueries({ queryKey: ['property'] });
    },
    onError: () => toast.error('Failed to update property'),
  });

  // --- Wing form ---
  const [wingName, setWingName] = useState('');

  const createWingMut = useMutation({
    mutationFn: async (name: string) =>
      unwrap<Wing>(await api.post('/properties/me/wings', { name })),
    onSuccess: () => {
      toast.success('Wing created');
      setWingName('');
      queryClient.invalidateQueries({ queryKey: ['wings'] });
    },
    onError: () => toast.error('Failed to create wing'),
  });

  // --- Bulk rooms form ---
  const [roomRows, setRoomRows] = useState<
    { roomNumber: string; floor: string; wingId: string }[]
  >([{ roomNumber: '', floor: '0', wingId: '' }]);

  const addRoomRow = () =>
    setRoomRows((prev) => [...prev, { roomNumber: '', floor: '0', wingId: '' }]);

  const removeRoomRow = (i: number) =>
    setRoomRows((prev) => prev.filter((_, idx) => idx !== i));

  const updateRoomRow = (
    i: number,
    field: 'roomNumber' | 'floor' | 'wingId',
    value: string,
  ) => {
    setRoomRows((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)),
    );
  };

  const createRoomsMut = useMutation({
    mutationFn: async () => {
      const rooms = roomRows
        .filter((r) => r.roomNumber.trim())
        .map((r) => ({
          roomNumber: r.roomNumber.trim(),
          floor: parseInt(r.floor, 10) || 0,
          ...(r.wingId ? { wingId: r.wingId } : {}),
        }));
      if (!rooms.length) throw new Error('Add at least one room');
      return unwrap<Room[]>(await api.post('/properties/me/rooms', { rooms }));
    },
    onSuccess: () => {
      toast.success('Rooms created');
      setRoomRows([{ roomNumber: '', floor: '0', wingId: '' }]);
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create rooms'),
  });

  // --- Bulk beds form ---
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [bedLabels, setBedLabels] = useState('');

  const createBedsMut = useMutation({
    mutationFn: async () => {
      if (!selectedRoomId) throw new Error('Select a room first');
      const labels = bedLabels
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);
      if (!labels.length) throw new Error('Enter bed labels');
      const beds = labels.map((bedLabel) => ({ bedLabel }));
      return api.post(`/properties/me/rooms/${selectedRoomId}/beds`, { beds });
    },
    onSuccess: () => {
      toast.success('Beds created');
      setBedLabels('');
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create beds'),
  });

  if (propertyQuery.isLoading) return <PageLoader />;
  if (propertyQuery.isError)
    return <ErrorMessage message="Failed to load property" onRetry={() => propertyQuery.refetch()} />;

  const wings = wingsQuery.data ?? [];
  const rooms = roomsQuery.data?.items ?? [];

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Property Setup</h1>

      {/* Property Details */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Property Details</h2>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            updatePropertyMut.mutate(propForm);
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={propForm.name}
              onChange={(e) => setPropForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              value={propForm.address}
              onChange={(e) => setPropForm((p) => ({ ...p, address: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              value={propForm.city}
              onChange={(e) => setPropForm((p) => ({ ...p, city: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              value={propForm.state}
              onChange={(e) => setPropForm((p) => ({ ...p, state: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={updatePropertyMut.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {updatePropertyMut.isPending ? <LoadingSpinner size="sm" /> : 'Save Property'}
            </button>
          </div>
        </form>
      </section>

      {/* Wings */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Wings</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {wings.map((w) => (
            <span
              key={w.id}
              className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium"
            >
              {w.name}
            </span>
          ))}
          {!wings.length && (
            <p className="text-sm text-gray-400">No wings created yet</p>
          )}
        </div>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (wingName.trim()) createWingMut.mutate(wingName.trim());
          }}
          className="flex gap-2"
        >
          <input
            value={wingName}
            onChange={(e) => setWingName(e.target.value)}
            placeholder="Wing name (e.g., A Block)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          <button
            type="submit"
            disabled={createWingMut.isPending || !wingName.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            Add Wing
          </button>
        </form>
      </section>

      {/* Bulk Room Creation */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Add Rooms
        </h2>
        <div className="space-y-3">
          {roomRows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-500 mb-1">Room Number</label>
                <input
                  value={row.roomNumber}
                  onChange={(e) => updateRoomRow(i, 'roomNumber', e.target.value)}
                  placeholder="101"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div className="w-20">
                <label className="block text-xs text-gray-500 mb-1">Floor</label>
                <input
                  type="number"
                  value={row.floor}
                  onChange={(e) => updateRoomRow(i, 'floor', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-500 mb-1">Wing</label>
                <select
                  value={row.wingId}
                  onChange={(e) => updateRoomRow(i, 'wingId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm bg-white"
                >
                  <option value="">No wing</option>
                  {wings.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              {roomRows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRoomRow(i)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={addRoomRow}
            className="flex items-center gap-1 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Add Row
          </button>
          <button
            onClick={() => createRoomsMut.mutate()}
            disabled={createRoomsMut.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm transition-colors"
          >
            {createRoomsMut.isPending ? 'Creating...' : 'Create Rooms'}
          </button>
        </div>
      </section>

      {/* Add Beds */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Beds to a Room</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Room</label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Choose a room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.roomNumber} (Floor {r.floor})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bed Labels (comma-separated)
            </label>
            <input
              value={bedLabels}
              onChange={(e) => setBedLabels(e.target.value)}
              placeholder="A, B, C"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
        </div>
        <button
          onClick={() => createBedsMut.mutate()}
          disabled={createBedsMut.isPending || !selectedRoomId}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {createBedsMut.isPending ? 'Creating...' : 'Create Beds'}
        </button>
      </section>

      {/* Existing Rooms Table */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Existing Rooms ({rooms.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Room</th>
                <th className="pb-2 font-medium">Floor</th>
                <th className="pb-2 font-medium">Wing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 font-medium text-gray-900">{r.roomNumber}</td>
                  <td className="py-2 text-gray-600">{r.floor}</td>
                  <td className="py-2 text-gray-600">{r.wing?.name || '-'}</td>
                </tr>
              ))}
              {!rooms.length && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-400">
                    No rooms yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
