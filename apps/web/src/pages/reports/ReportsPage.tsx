import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  DocumentChartBarIcon,
  CurrencyRupeeIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import api, { unwrap } from '@/lib/api';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import { formatRupees } from '@/lib/format';

type ReportType = 'occupancy' | 'dues' | 'residents' | 'collection';

interface ReportCard {
  type: ReportType;
  title: string;
  description: string;
  icon: React.ElementType;
}

const reportCards: ReportCard[] = [
  {
    type: 'occupancy',
    title: 'Occupancy Report',
    description: 'Bed occupancy rates across all properties and rooms.',
    icon: DocumentChartBarIcon,
  },
  {
    type: 'dues',
    title: 'Dues Report',
    description: 'Outstanding dues and payment status for residents.',
    icon: CurrencyRupeeIcon,
  },
  {
    type: 'residents',
    title: 'Resident List',
    description: 'Complete list of all active and past residents.',
    icon: UserGroupIcon,
  },
  {
    type: 'collection',
    title: 'Monthly Collection',
    description: 'Revenue collected for a specific month and year.',
    icon: CalendarDaysIcon,
  },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [collectionMonth, setCollectionMonth] = useState(
    () => new Date().getMonth() + 1,
  );
  const [collectionYear, setCollectionYear] = useState(
    () => new Date().getFullYear(),
  );

  const queryParams =
    activeReport === 'collection'
      ? { format: 'json', month: collectionMonth, year: collectionYear }
      : { format: 'json' };

  const {
    data: reportData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['report', activeReport, queryParams],
    queryFn: async () =>
      unwrap<Record<string, unknown>>(
        await api.get(`/reports/${activeReport}`, { params: queryParams }),
      ),
    enabled: !!activeReport,
  });

  const handleDownload = async (
    type: ReportType,
    fileFormat: 'pdf' | 'excel',
  ) => {
    try {
      const params: Record<string, string | number> = { format: fileFormat };
      if (type === 'collection') {
        params.month = collectionMonth;
        params.year = collectionYear;
      }
      const response = await api.get(`/reports/${type}`, {
        params,
        responseType: 'blob',
      });
      const ext = fileFormat === 'pdf' ? 'pdf' : 'xlsx';
      const blob = new Blob([response.data as BlobPart]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${fileFormat.toUpperCase()} downloaded`);
    } catch {
      toast.error(`Failed to download ${fileFormat.toUpperCase()}`);
    }
  };

  const handleGenerate = (type: ReportType) => {
    setActiveReport(type);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

      {/* Report type cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportCards.map((card) => {
          const Icon = card.icon;
          const isActive = activeReport === card.type;
          return (
            <div
              key={card.type}
              className={`bg-white rounded-xl border p-5 flex flex-col gap-3 transition-colors ${
                isActive
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">{card.title}</h3>
              </div>
              <p className="text-sm text-gray-500 flex-1">{card.description}</p>

              {card.type === 'collection' && (
                <div className="flex gap-2">
                  <select
                    value={collectionMonth}
                    onChange={(e) => setCollectionMonth(Number(e.target.value))}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {format(new Date(2024, i), 'MMM')}
                      </option>
                    ))}
                  </select>
                  <select
                    value={collectionYear}
                    onChange={(e) => setCollectionYear(Number(e.target.value))}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const y = new Date().getFullYear() - 2 + i;
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <button
                onClick={() => handleGenerate(card.type)}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Generate
              </button>
            </div>
          );
        })}
      </div>

      {/* Report data */}
      {activeReport && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {reportCards.find((c) => c.type === activeReport)?.title} Results
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload(activeReport, 'pdf')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download PDF
              </button>
              <button
                onClick={() => handleDownload(activeReport, 'excel')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download Excel
              </button>
            </div>
          </div>

          {isLoading && <PageLoader />}
          {isError && (
            <ErrorMessage
              message="Failed to generate report"
              onRetry={refetch}
            />
          )}
          {reportData && !isLoading && (
            <ReportDataView type={activeReport} data={reportData} />
          )}
        </div>
      )}
    </div>
  );
}

function ReportDataView({
  type,
  data,
}: {
  type: ReportType;
  data: Record<string, unknown>;
}) {
  if (type === 'occupancy') {
    const d = data as {
      totalBeds?: number;
      occupiedBeds?: number;
      vacantBeds?: number;
      occupancyRate?: number;
      rooms?: Array<{
        roomNumber: string;
        wingName: string | null;
        beds: Array<{
          bedLabel: string;
          status: string;
          residentName: string | null;
        }>;
      }>;
    };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Beds" value={d.totalBeds ?? 0} />
          <StatCard label="Occupied" value={d.occupiedBeds ?? 0} />
          <StatCard label="Vacant" value={d.vacantBeds ?? 0} />
          <StatCard
            label="Occupancy Rate"
            value={`${(d.occupancyRate ?? 0).toFixed(1)}%`}
          />
        </div>
        {d.rooms && d.rooms.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-gray-50">
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium">Wing</th>
                  <th className="px-4 py-3 font-medium">Bed</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Resident</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.rooms.flatMap((room) =>
                  room.beds.map((bed, bi) => (
                    <tr key={`${room.roomNumber}-${bi}`}>
                      <td className="px-4 py-3 text-gray-900">
                        {room.roomNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {room.wingName ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {bed.bedLabel}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={bed.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {bed.residentName ?? '-'}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (type === 'dues') {
    const items = (data as { items?: Array<Record<string, unknown>> }).items ?? [];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="px-4 py-3 font-medium">Resident</th>
              <th className="px-4 py-3 font-medium">Amount Due</th>
              <th className="px-4 py-3 font-medium">Due Since</th>
              <th className="px-4 py-3 font-medium">Settled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-gray-900">
                  {String(item.residentName ?? '-')}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatRupees(String(item.amountDuePaisa ?? '0'))}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {item.dueSince
                    ? format(new Date(String(item.dueSince)), 'dd MMM yyyy')
                    : '-'}
                </td>
                <td className="px-4 py-3">
                  {item.settled ? (
                    <span className="text-green-600 font-medium">Yes</span>
                  ) : (
                    <span className="text-red-600 font-medium">No</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                  No dues found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === 'residents') {
    const items = (data as { items?: Array<Record<string, unknown>> }).items ?? [];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Room / Bed</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Admission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-gray-900">
                  {String(item.fullName ?? '-')}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {String(item.phone ?? '-')}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {String(item.roomBed ?? '-')}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={String(item.status ?? 'active')} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {item.admissionDate
                    ? format(
                        new Date(String(item.admissionDate)),
                        'dd MMM yyyy',
                      )
                    : '-'}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  No residents found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === 'collection') {
    const d = data as {
      totalCollectedPaisa?: string;
      totalDuePaisa?: string;
      items?: Array<Record<string, unknown>>;
    };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Total Collected"
            value={formatRupees(d.totalCollectedPaisa ?? '0')}
          />
          <StatCard
            label="Total Due"
            value={formatRupees(d.totalDuePaisa ?? '0')}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="px-4 py-3 font-medium">Resident</th>
                <th className="px-4 py-3 font-medium">Amount Paid</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(d.items ?? []).map((item, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-gray-900">
                    {String(item.residentName ?? '-')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatRupees(String(item.amountPaisa ?? '0'))}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {String(item.method ?? '-')}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.paidOn
                      ? format(new Date(String(item.paidOn)), 'dd MMM yyyy')
                      : '-'}
                  </td>
                </tr>
              ))}
              {(d.items ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No collections found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    occupied: 'bg-green-100 text-green-700',
    vacant: 'bg-blue-100 text-blue-700',
    maintenance: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    vacated: 'bg-red-100 text-red-700',
    transferred: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {status}
    </span>
  );
}
