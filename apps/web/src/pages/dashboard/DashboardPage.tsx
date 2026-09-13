import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  HomeIcon,
  UserGroupIcon,
  CurrencyRupeeIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import api, { unwrap } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import type { OccupancyData, DashboardSummary } from '@/lib/types';
import { format } from 'date-fns';

const PIE_COLORS = ['#22c55e', '#ef4444', '#eab308'];

export default function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => unwrap<DashboardSummary>(await api.get('/dashboard')),
  });

  const occupancyQuery = useQuery({
    queryKey: ['occupancy'],
    queryFn: async () =>
      unwrap<OccupancyData>(await api.get('/properties/me/occupancy')),
  });

  if (summaryQuery.isLoading || occupancyQuery.isLoading) return <PageLoader />;
  if (summaryQuery.isError || occupancyQuery.isError)
    return (
      <ErrorMessage
        message="Failed to load dashboard data"
        onRetry={() => {
          summaryQuery.refetch();
          occupancyQuery.refetch();
        }}
      />
    );

  const summary = summaryQuery.data;
  const occ = occupancyQuery.data;

  const pieData = occ
    ? [
        { name: 'Vacant', value: occ.vacantBeds },
        { name: 'Occupied', value: occ.occupiedBeds },
        { name: 'Maintenance', value: occ.maintenanceBeds },
      ]
    : [];

  const barData = occ
    ? occ.rooms
        .reduce<{ floor: number; occupied: number; vacant: number }[]>(
          (acc, room) => {
            let entry = acc.find((a) => a.floor === room.floor);
            if (!entry) {
              entry = { floor: room.floor, occupied: 0, vacant: 0 };
              acc.push(entry);
            }
            room.beds.forEach((bed) => {
              if (bed.status === 'occupied') entry!.occupied++;
              else if (bed.status === 'vacant') entry!.vacant++;
            });
            return acc;
          },
          [],
        )
        .sort((a, b) => a.floor - b.floor)
    : [];

  const stats = [
    {
      label: 'Total Beds',
      value: summary?.totalBeds ?? 0,
      icon: HomeIcon,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Occupancy Rate',
      value: `${Math.round(summary?.occupancyRate ?? 0)}%`,
      icon: UserGroupIcon,
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Total Dues',
      value: formatRupees(summary?.totalDuesPaisa ?? '0'),
      icon: CurrencyRupeeIcon,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Vacant Beds',
      value: occ?.vacantBeds ?? 0,
      icon: ExclamationCircleIcon,
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy pie chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Occupancy Overview
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Floor-wise occupancy */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Floor-wise Occupancy
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="floor" tickFormatter={(v) => `Floor ${v}`} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="occupied" fill="#ef4444" name="Occupied" />
                <Bar dataKey="vacant" fill="#22c55e" name="Vacant" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Admissions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Admissions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Bed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(summary?.recentAdmissions ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-medium text-gray-900">{r.fullName}</td>
                    <td className="py-2 text-gray-500">
                      {format(new Date(r.admissionDate), 'dd MMM yyyy')}
                    </td>
                    <td className="py-2 text-gray-500">
                      {r.bedLabel
                        ? [r.roomNumber, r.bedLabel].filter(Boolean).join(' / ')
                        : 'Unassigned'}
                    </td>
                  </tr>
                ))}
                {!summary?.recentAdmissions.length && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-400">
                      No recent admissions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Payments
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Resident</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(summary?.recentPayments ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 font-medium text-gray-900">
                      {p.residentName}
                    </td>
                    <td className="py-2 text-gray-700">
                      {formatRupees(p.amountPaisa)}
                    </td>
                    <td className="py-2 text-gray-500">
                      {format(new Date(p.paidOn), 'dd MMM yyyy')}
                    </td>
                  </tr>
                ))}
                {!summary?.recentPayments.length && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-400">
                      No recent payments
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
