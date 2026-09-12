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
import type { OccupancyData, PaginatedResult, Resident, Dues, Payment } from '@/lib/types';
import { format } from 'date-fns';

const PIE_COLORS = ['#22c55e', '#ef4444', '#eab308'];

export default function DashboardPage() {
  const occupancyQuery = useQuery({
    queryKey: ['occupancy'],
    queryFn: async () =>
      unwrap<OccupancyData>(await api.get('/properties/me/occupancy')),
  });

  const residentsQuery = useQuery({
    queryKey: ['residents', 'recent'],
    queryFn: async () =>
      unwrap<PaginatedResult<Resident>>(
        await api.get('/residents', { params: { page: 1, pageSize: 5, sortBy: 'createdAt', sortDir: 'desc' } }),
      ),
  });

  const duesQuery = useQuery({
    queryKey: ['dues', 'summary'],
    queryFn: async () =>
      unwrap<PaginatedResult<Dues>>(
        await api.get('/billing/dues', { params: { page: 1, pageSize: 100, settled: false } }),
      ),
  });

  const paymentsQuery = useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: async () =>
      unwrap<PaginatedResult<Payment>>(
        await api.get('/billing/payments', { params: { page: 1, pageSize: 5, sortDir: 'desc' } }),
      ),
  });

  if (occupancyQuery.isLoading) return <PageLoader />;
  if (occupancyQuery.isError)
    return <ErrorMessage message="Failed to load dashboard data" onRetry={() => occupancyQuery.refetch()} />;

  const occ = occupancyQuery.data;
  const totalDuesPaisa = duesQuery.data?.items.reduce(
    (sum, d) => sum + parseInt(String(d.amountDuePaisa), 10),
    0,
  ) ?? 0;

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
      value: occ?.totalBeds ?? 0,
      icon: HomeIcon,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Occupancy Rate',
      value: `${Math.round(occ?.occupancyRate ?? 0)}%`,
      icon: UserGroupIcon,
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Total Dues',
      value: formatRupees(totalDuesPaisa),
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
          {residentsQuery.isLoading ? (
            <PageLoader />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(residentsQuery.data?.items ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 font-medium text-gray-900">{r.fullName}</td>
                      <td className="py-2 text-gray-500">
                        {format(new Date(r.admissionDate), 'dd MMM yyyy')}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                            r.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : r.status === 'vacated'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!residentsQuery.data?.items.length && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-gray-400">
                        No recent admissions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Payments
          </h3>
          {paymentsQuery.isLoading ? (
            <PageLoader />
          ) : (
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
                  {(paymentsQuery.data?.items ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 font-medium text-gray-900">
                        {p.resident?.fullName ?? 'Unknown'}
                      </td>
                      <td className="py-2 text-gray-700">
                        {formatRupees(p.amountPaisa)}
                      </td>
                      <td className="py-2 text-gray-500">
                        {format(new Date(p.paidOn), 'dd MMM yyyy')}
                      </td>
                    </tr>
                  ))}
                  {!paymentsQuery.data?.items.length && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-gray-400">
                        No recent payments
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
