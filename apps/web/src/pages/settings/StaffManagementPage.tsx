import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api, { unwrap } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function StaffManagementPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isOwner = user?.role === 'owner';

  const { data: staff, isLoading, isError, refetch } = useQuery({
    queryKey: ['org-staff'],
    queryFn: async () =>
      unwrap<StaffMember[]>(await api.get('/organizations/me/staff')),
    enabled: isOwner,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/organizations/me/staff', {
        email: formEmail,
        name: formName,
        password: formPassword,
      });
    },
    onSuccess: () => {
      toast.success('Staff member added');
      queryClient.invalidateQueries({ queryKey: ['org-staff'] });
      resetForm();
    },
    onError: () => {
      toast.error('Failed to add staff member');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/organizations/me/staff/${id}`);
    },
    onSuccess: () => {
      toast.success('Staff member removed');
      queryClient.invalidateQueries({ queryKey: ['org-staff'] });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast.error('Failed to remove staff member');
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setFormEmail('');
    setFormName('');
    setFormPassword('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  // Only owners can manage staff
  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-gray-600">
          Only organization owners can manage staff.
        </p>
      </div>
    );
  }

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorMessage message="Failed to load staff" onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Staff
        </button>
      </div>

      {/* Add staff form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Add Staff Member
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="staff@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Initial password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
                minLength={8}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? 'Adding...' : 'Add Staff'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(staff ?? []).map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 text-xs rounded-full font-medium bg-purple-100 text-purple-700">
                      {s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {deleteConfirmId === s.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteMutation.mutate(s.id)}
                          disabled={deleteMutation.isPending}
                          className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(s.id)}
                        className="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove staff member"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!staff?.length && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No staff members added yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
