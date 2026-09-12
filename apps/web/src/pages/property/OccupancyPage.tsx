import { useQuery } from '@tanstack/react-query';
import api, { unwrap } from '@/lib/api';
import { PageLoader } from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import type { OccupancyData, OccupancyBed } from '@/lib/types';

const statusColors: Record<string, string> = {
  vacant: 'bg-green-100 border-green-400 text-green-800',
  occupied: 'bg-red-100 border-red-400 text-red-800',
  maintenance: 'bg-yellow-100 border-yellow-400 text-yellow-800',
};

const statusDots: Record<string, string> = {
  vacant: 'bg-green-500',
  occupied: 'bg-red-500',
  maintenance: 'bg-yellow-500',
};

function BedCard({ bed }: { bed: OccupancyBed }) {
  return (
    <div
      className={`border rounded-lg p-3 text-sm ${statusColors[bed.status] ?? 'bg-gray-100 border-gray-300'}`}
    >
      <div className="flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${statusDots[bed.status] ?? 'bg-gray-400'}`} />
        <span className="font-medium">{bed.bedLabel}</span>
      </div>
      {bed.residentName && (
        <p className="mt-1 text-xs truncate">{bed.residentName}</p>
      )}
    </div>
  );
}

export default function OccupancyPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['occupancy'],
    queryFn: async () =>
      unwrap<OccupancyData>(await api.get('/properties/me/occupancy')),
  });

  if (isLoading) return <PageLoader />;
  if (isError)
    return <ErrorMessage message="Failed to load occupancy data" onRetry={refetch} />;
  if (!data) return null;

  const grouped = data.rooms.reduce<
    Record<number, typeof data.rooms>
  >((acc, room) => {
    if (!acc[room.floor]) acc[room.floor] = [];
    acc[room.floor]!.push(room);
    return acc;
  }, {});

  const floors = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Occupancy Grid</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-green-500" />
            Vacant ({data.vacantBeds})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            Occupied ({data.occupiedBeds})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-yellow-500" />
            Maintenance ({data.maintenanceBeds})
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-600">
        <strong>{Math.round(data.occupancyRate)}%</strong> occupancy - {data.occupiedBeds} of{' '}
        {data.totalBeds} beds occupied
      </div>

      {floors.map((floor) => (
        <div key={floor} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Floor {floor}</h2>
          <div className="space-y-4">
            {grouped[floor]!.map((room) => (
              <div
                key={room.id}
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-medium text-gray-900">
                    Room {room.roomNumber}
                  </h3>
                  {room.wingName && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {room.wingName}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {room.beds.map((bed) => (
                    <BedCard key={bed.id} bed={bed} />
                  ))}
                  {!room.beds.length && (
                    <p className="text-sm text-gray-400 col-span-full">
                      No beds in this room
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!floors.length && (
        <div className="text-center text-gray-400 py-12">
          No rooms found. Set up your property first.
        </div>
      )}
    </div>
  );
}
