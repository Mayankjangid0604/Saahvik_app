import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorCodes } from '../common/error-codes';
import { BedStatus } from '@prisma/client';

@Injectable()
export class PropertyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async findPropertyByOrg(orgId: string) {
    const property = await this.prisma.property.findFirst({
      where: { organizationId: orgId },
    });
    if (!property) {
      throw new NotFoundException(ErrorCodes.PROPERTY_NOT_FOUND);
    }
    return property;
  }

  async getMyProperty(orgId: string) {
    return this.findPropertyByOrg(orgId);
  }

  async updateProperty(orgId: string, data: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    timezone?: string;
  }) {
    const property = await this.findPropertyByOrg(orgId);
    return this.prisma.property.update({
      where: { id: property.id },
      data,
    });
  }

  async createWing(orgId: string, name: string) {
    const property = await this.findPropertyByOrg(orgId);
    return this.prisma.wing.create({
      data: {
        name,
        propertyId: property.id,
      },
    });
  }

  async getWings(orgId: string) {
    const property = await this.findPropertyByOrg(orgId);
    return this.prisma.wing.findMany({
      where: { propertyId: property.id },
      orderBy: { name: 'asc' },
    });
  }

  async createRooms(orgId: string, rooms: { roomNumber: string; floor: number; wingId?: string }[]) {
    const property = await this.findPropertyByOrg(orgId);

    // Validate wingIds if provided
    const wingIds = [...new Set(rooms.filter((r) => r.wingId).map((r) => r.wingId!))];
    if (wingIds.length > 0) {
      const existingWings = await this.prisma.wing.findMany({
        where: { id: { in: wingIds }, propertyId: property.id },
        select: { id: true },
      });
      const existingIds = new Set(existingWings.map((w) => w.id));
      const missing = wingIds.filter((id) => !existingIds.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(
          `Wings not found or do not belong to this property: ${missing.join(', ')}`,
        );
      }
    }

    const data = rooms.map((r) => ({
      roomNumber: r.roomNumber,
      floor: r.floor,
      wingId: r.wingId || null,
      propertyId: property.id,
    }));

    const result = await this.prisma.room.createMany({ data });
    return { count: result.count };
  }

  async getRooms(
    orgId: string,
    filters: {
      wingId?: string;
      floor?: number;
      roomNumber?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const property = await this.findPropertyByOrg(orgId);

    const where: Record<string, unknown> = { propertyId: property.id };
    if (filters.wingId) where.wingId = filters.wingId;
    if (filters.floor !== undefined) where.floor = filters.floor;
    if (filters.roomNumber) where.roomNumber = { contains: filters.roomNumber, mode: 'insensitive' };

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        include: {
          wing: { select: { id: true, name: true } },
          _count: { select: { beds: true } },
        },
        orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.room.count({ where }),
    ]);

    // Enrich with bed status counts
    const roomIds = items.map((r) => r.id);
    const bedCounts = await this.prisma.bed.groupBy({
      by: ['roomId', 'status'],
      where: { roomId: { in: roomIds } },
      _count: { id: true },
    });

    const bedCountMap = new Map<string, Record<string, number>>();
    for (const bc of bedCounts) {
      if (!bedCountMap.has(bc.roomId)) {
        bedCountMap.set(bc.roomId, { vacant: 0, occupied: 0, maintenance: 0 });
      }
      bedCountMap.get(bc.roomId)![bc.status] = bc._count.id;
    }

    const enrichedItems = items.map((room) => {
      const counts = bedCountMap.get(room.id) || { vacant: 0, occupied: 0, maintenance: 0 };
      return {
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        wing: room.wing,
        totalBeds: room._count.beds,
        bedCounts: counts,
        createdAt: room.createdAt,
      };
    });

    return { items: enrichedItems, total, page, pageSize };
  }

  async createBeds(orgId: string, roomId: string, beds: { bedLabel: string }[]) {
    const property = await this.findPropertyByOrg(orgId);

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId: property.id },
    });
    if (!room) {
      throw new NotFoundException(ErrorCodes.ROOM_NOT_FOUND);
    }

    const data = beds.map((b) => ({
      bedLabel: b.bedLabel,
      roomId: room.id,
      status: BedStatus.vacant,
    }));

    const result = await this.prisma.bed.createMany({ data });
    return { count: result.count };
  }

  async getBeds(orgId: string, roomId: string) {
    const property = await this.findPropertyByOrg(orgId);

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, propertyId: property.id },
    });
    if (!room) {
      throw new NotFoundException(ErrorCodes.ROOM_NOT_FOUND);
    }

    return this.prisma.bed.findMany({
      where: { roomId: room.id },
      orderBy: { bedLabel: 'asc' },
    });
  }

  async getOccupancy(orgId: string) {
    const property = await this.findPropertyByOrg(orgId);

    const rooms = await this.prisma.room.findMany({
      where: { propertyId: property.id },
      include: {
        wing: { select: { name: true } },
        beds: {
          orderBy: { bedLabel: 'asc' },
        },
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
    });

    const bedIds = rooms.flatMap((r) => r.beds.map((b) => b.id));

    const activeResidents = await this.prisma.resident.findMany({
      where: { bedId: { in: bedIds }, status: 'active' },
      select: { bedId: true, fullName: true },
    });
    const residentByBedId = new Map(
      activeResidents.map((r) => [r.bedId as string, r.fullName]),
    );

    let totalBeds = 0;
    let occupiedBeds = 0;
    let vacantBeds = 0;
    let maintenanceBeds = 0;

    const roomsWithBeds = rooms.map((room) => {
      const beds = room.beds.map((bed) => {
        totalBeds++;
        if (bed.status === BedStatus.occupied) occupiedBeds++;
        else if (bed.status === BedStatus.vacant) vacantBeds++;
        else if (bed.status === BedStatus.maintenance) maintenanceBeds++;

        return {
          id: bed.id,
          bedLabel: bed.bedLabel,
          status: bed.status,
          residentName: residentByBedId.get(bed.id) ?? null,
        };
      });

      return {
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        wingName: room.wing?.name ?? null,
        beds,
      };
    });

    const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;

    return {
      totalBeds,
      occupiedBeds,
      vacantBeds,
      maintenanceBeds,
      occupancyRate,
      rooms: roomsWithBeds,
    };
  }
}
