import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PaperAirplaneIcon, MegaphoneIcon } from '@heroicons/react/24/outline';
import api, { unwrap } from '@/lib/api';
import type { NotificationChannel, NotificationTemplate } from '@/lib/types';

type Mode = 'single' | 'broadcast';

export default function NotificationComposePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('single');
  const [channel, setChannel] = useState<NotificationChannel>('email');
  const [recipient, setRecipient] = useState('');
  const [broadcastRecipients, setBroadcastRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [sending, setSending] = useState(false);

  const { data: templates } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: async () =>
      unwrap<NotificationTemplate[]>(
        await api.get('/notifications/templates'),
      ),
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (!templateId) return;
    const tpl = templates?.find((t) => t.id === templateId);
    if (tpl) {
      setChannel(tpl.channel);
      setSubject(tpl.subject ?? '');
      setBody(tpl.body);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      if (mode === 'broadcast') {
        const recipients = broadcastRecipients
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean);
        if (recipients.length === 0) {
          toast.error('Enter at least one recipient');
          setSending(false);
          return;
        }
        await api.post('/notifications/broadcast', {
          channel,
          recipients,
          subject: channel === 'email' ? subject : undefined,
          body,
          templateId: selectedTemplate || undefined,
        });
        toast.success(`Broadcast sent to ${recipients.length} recipients`);
      } else {
        if (!recipient.trim()) {
          toast.error('Enter a recipient');
          setSending(false);
          return;
        }
        const payload: Record<string, unknown> = {
          channel,
          body,
          templateId: selectedTemplate || undefined,
        };
        if (channel === 'email') {
          payload.recipientEmail = recipient.trim();
          payload.subject = subject;
        } else {
          payload.recipientPhone = recipient.trim();
        }
        await api.post('/notifications/send', payload);
        toast.success('Notification sent');
      }
      navigate('/notifications');
    } catch {
      toast.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const recipientLabel = channel === 'email' ? 'Email Address' : 'Phone Number';
  const recipientPlaceholder =
    channel === 'email' ? 'recipient@example.com' : '+91XXXXXXXXXX';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Compose Notification</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'single'
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            Single
          </button>
          <button
            type="button"
            onClick={() => setMode('broadcast')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'broadcast'
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <MegaphoneIcon className="h-4 w-4" />
            Broadcast
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template picker */}
          {templates && templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template (optional)
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">None</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.channel})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Channel
            </label>
            <select
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as NotificationChannel)
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>

          {/* Recipient(s) */}
          {mode === 'single' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {recipientLabel}
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={recipientPlaceholder}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipients (one per line)
              </label>
              <textarea
                value={broadcastRecipients}
                onChange={(e) => setBroadcastRecipients(e.target.value)}
                placeholder={`${recipientPlaceholder}\n${recipientPlaceholder}`}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          )}

          {/* Subject (email only) */}
          {channel === 'email' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Notification subject"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          )}

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here..."
              rows={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              {sending ? 'Sending...' : mode === 'broadcast' ? 'Send Broadcast' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
