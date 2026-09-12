import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api, { unwrap } from '@/lib/api';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import type { NotificationChannel, NotificationTemplate } from '@/lib/types';

export default function NotificationTemplatesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formChannel, setFormChannel] = useState<NotificationChannel>('email');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: templates, isLoading, isError, refetch } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: async () =>
      unwrap<NotificationTemplate[]>(
        await api.get('/notifications/templates'),
      ),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/notifications/templates', {
        name: formName,
        channel: formChannel,
        subject: formChannel === 'email' ? formSubject : undefined,
        body: formBody,
      });
    },
    onSuccess: () => {
      toast.success('Template created');
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      resetForm();
    },
    onError: () => {
      toast.error('Failed to create template');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/templates/${id}`);
    },
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast.error('Failed to delete template');
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setFormName('');
    setFormChannel('email');
    setFormSubject('');
    setFormBody('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  if (isLoading) return <PageLoader />;
  if (isError)
    return (
      <ErrorMessage message="Failed to load templates" onRetry={refetch} />
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Notification Templates
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          New Template
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Create Template
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
                placeholder="e.g. Rent Reminder"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Channel
              </label>
              <select
                value={formChannel}
                onChange={(e) =>
                  setFormChannel(e.target.value as NotificationChannel)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>

            {formChannel === 'email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Email subject line"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Body
              </label>
              <textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder={'Use {{variable}} for placeholders.\ne.g. Dear {{name}}, your rent of {{amount}} is due.'}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
              <p className="mt-1 text-xs text-gray-400">
                Use {'{{variable}}'} syntax for dynamic placeholders.
              </p>
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
                {createMutation.isPending ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Template list */}
      <div className="space-y-3">
        {(templates ?? []).length === 0 && !showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No templates yet. Create one to get started.
          </div>
        )}
        {(templates ?? []).map((tpl) => (
          <div
            key={tpl.id}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
                  <span className="inline-block px-2 py-0.5 text-xs rounded-full font-medium bg-blue-100 text-blue-700">
                    {tpl.channel}
                  </span>
                </div>
                {tpl.subject && (
                  <p className="text-sm text-gray-600 mb-1">
                    Subject: {tpl.subject}
                  </p>
                )}
                <p className="text-sm text-gray-500 whitespace-pre-wrap">
                  {tpl.body}
                </p>
                {tpl.variables.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {tpl.variables.map((v) => (
                      <span
                        key={v}
                        className="inline-block px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600"
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="ml-4">
                {deleteConfirmId === tpl.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Delete?</span>
                    <button
                      onClick={() => deleteMutation.mutate(tpl.id)}
                      disabled={deleteMutation.isPending}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(tpl.id)}
                    className="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete template"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
