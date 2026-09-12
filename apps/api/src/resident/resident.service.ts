import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorCodes } from '../common/error-codes';
import { parsePagination, PaginatedResult } from '../common/pagination';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { ResidentQueryDto } from './dto/resident-query.dto';
import { SearchResidentsDto } from './dto/search-residents.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ResidentService {
  private readonly logger = new Logger(ResidentService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async createResident(
    orgId: string,
    userId: string,
    data: CreateResidentDto,
    idempotencyKey: string,
  ) {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { key: idempotencyKey },
    });
    if (existing) {
      return existing.response;
    }

    if (data.bedId) {
      const bed = await this.prisma.bed.findUnique({
        where: { id: data.bedId },
        include: { room: true },
      });
      if (!bed) {
        throw new NotFoundException(ErrorCodes.BED_NOT_FOUND);
      }
      if (bed.status !== 'vacant') {
        throw new ConflictException(ErrorCodes.BED_ALREADY_OCCUPIED);
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const resident = await tx.resident.create({
        data: {
          organizationId: orgId,
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          photoKey: data.photoKey,
          idDocumentKey: data.idDocumentKey,
          admissionDate: new Date(data.admissionDate),
          bedId: data.bedId || null,
          status: 'active',
        },
      });

      if (data.bedId) {
        await tx.bed.update({
          where: { id: data.bedId },
          data: { status: 'occupied' },
        });
      }

      for (const g of data.guardians) {
        const guardian = await tx.guardian.create({
          data: {
            organizationId: orgId,
            fullName: g.fullName,
            phone: g.phone,
            email: g.email,
          },
        });

        await tx.guardianLink.create({
          data: {
            residentId: resident.id,
            guardianId: guardian.id,
            relationship: g.relationship,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          action: 'resident.admitted',
          entityType: 'resident',
          entityId: resident.id,
          metadata: {
            fullName: data.fullName,
            admissionDate: data.admissionDate,
            bedId: data.bedId || null,
            guardianCount: data.guardians.length,
          } as any,
        },
      });

      await tx.idempotencyRecord.create({
        data: {
          key: idempotencyKey,
          response: { id: resident.id } as any,
        },
      });

      return resident;
    });

    return result;
  }

  async getResidents(
    orgId: string,
    query: ResidentQueryDto,
  ): Promise<PaginatedResult<any>> {
    const { page, pageSize, skip, take } = parsePagination(query);

    const where: Prisma.ResidentWhereInput = {
      organizationId: orgId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.ResidentOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortDir || 'desc';
    (orderBy as any)[sortField] = sortDir;

    const [items, total] = await Promise.all([
      this.prisma.resident.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          bed: {
            include: {
              room: {
                include: { wing: true },
              },
            },
          },
        },
      }),
      this.prisma.resident.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getResident(orgId: string, residentId: string) {
    const resident = await this.prisma.resident.findFirst({
      where: {
        id: residentId,
        organizationId: orgId,
      },
      include: {
        bed: {
          include: {
            room: {
              include: { wing: true },
            },
          },
        },
        guardianLinks: {
          include: { guardian: true },
        },
        feeStructures: {
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    if (!resident) {
      throw new NotFoundException(ErrorCodes.RESIDENT_NOT_FOUND);
    }

    return resident;
  }

  async updateResident(
    orgId: string,
    residentId: string,
    userId: string,
    data: UpdateResidentDto,
  ) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, organizationId: orgId },
    });

    if (!resident) {
      throw new NotFoundException(ErrorCodes.RESIDENT_NOT_FOUND);
    }

    const updateData: Prisma.ResidentUpdateInput = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.photoKey !== undefined) updateData.photoKey = data.photoKey;
    if (data.idDocumentKey !== undefined) updateData.idDocumentKey = data.idDocumentKey;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.resident.update({
        where: { id: residentId },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          action: 'resident.updated',
          entityType: 'resident',
          entityId: residentId,
          metadata: {
            changes: data as any,
          },
        },
      });

      return result;
    });

    return updated;
  }

  async assignBed(
    orgId: string,
    residentId: string,
    bedId: string,
    userId: string,
    idempotencyKey: string,
  ) {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { key: idempotencyKey },
    });
    if (existing) {
      return existing.response;
    }

    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, organizationId: orgId },
    });
    if (!resident) {
      throw new NotFoundException(ErrorCodes.RESIDENT_NOT_FOUND);
    }

    if (resident.status !== 'active') {
      throw new BadRequestException(ErrorCodes.RESIDENT_ALREADY_VACATED);
    }

    const bed = await this.prisma.bed.findUnique({
      where: { id: bedId },
      include: { room: true },
    });
    if (!bed) {
      throw new NotFoundException(ErrorCodes.BED_NOT_FOUND);
    }
    if (bed.status !== 'vacant') {
      throw new ConflictException(ErrorCodes.BED_ALREADY_OCCUPIED);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Clear previous bed if any
      if (resident.bedId) {
        await tx.bed.update({
          where: { id: resident.bedId },
          data: { status: 'vacant' },
        });
      }

      await tx.bed.update({
        where: { id: bedId },
        data: { status: 'occupied' },
      });

      const updated = await tx.resident.update({
        where: { id: residentId },
        data: { bedId },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          action: 'resident.bed_assigned',
          entityType: 'resident',
          entityId: residentId,
          metadata: {
            bedId,
            previousBedId: resident.bedId,
          } as any,
        },
      });

      await tx.idempotencyRecord.create({
        data: {
          key: idempotencyKey,
          response: { residentId: updated.id, bedId } as any,
        },
      });

      return updated;
    });

    return result;
  }

  async vacateResident(
    orgId: string,
    residentId: string,
    userId: string,
    vacateDate: string,
    idempotencyKey: string,
  ) {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { key: idempotencyKey },
    });
    if (existing) {
      return existing.response;
    }

    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, organizationId: orgId },
    });
    if (!resident) {
      throw new NotFoundException(ErrorCodes.RESIDENT_NOT_FOUND);
    }

    if (resident.status === 'vacated') {
      throw new BadRequestException(ErrorCodes.RESIDENT_ALREADY_VACATED);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (resident.bedId) {
        await tx.bed.update({
          where: { id: resident.bedId },
          data: { status: 'vacant' },
        });
      }

      const updated = await tx.resident.update({
        where: { id: residentId },
        data: {
          status: 'vacated',
          vacateDate: new Date(vacateDate),
          bedId: null,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          action: 'resident.vacated',
          entityType: 'resident',
          entityId: residentId,
          metadata: {
            vacateDate,
            previousBedId: resident.bedId,
          } as any,
        },
      });

      await tx.idempotencyRecord.create({
        data: {
          key: idempotencyKey,
          response: { residentId: updated.id, status: 'vacated' } as any,
        },
      });

      return updated;
    });

    return result;
  }

  async transferResident(
    orgId: string,
    residentId: string,
    newBedId: string,
    userId: string,
    idempotencyKey: string,
  ) {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { key: idempotencyKey },
    });
    if (existing) {
      return existing.response;
    }

    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, organizationId: orgId },
    });
    if (!resident) {
      throw new NotFoundException(ErrorCodes.RESIDENT_NOT_FOUND);
    }

    if (resident.status !== 'active') {
      throw new BadRequestException(ErrorCodes.RESIDENT_ALREADY_VACATED);
    }

    const newBed = await this.prisma.bed.findUnique({
      where: { id: newBedId },
      include: { room: true },
    });
    if (!newBed) {
      throw new NotFoundException(ErrorCodes.BED_NOT_FOUND);
    }
    if (newBed.status !== 'vacant') {
      throw new ConflictException(ErrorCodes.BED_ALREADY_OCCUPIED);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Vacate old bed
      if (resident.bedId) {
        await tx.bed.update({
          where: { id: resident.bedId },
          data: { status: 'vacant' },
        });
      }

      // Assign new bed
      await tx.bed.update({
        where: { id: newBedId },
        data: { status: 'occupied' },
      });

      const updated = await tx.resident.update({
        where: { id: residentId },
        data: {
          bedId: newBedId,
          status: 'transferred',
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          action: 'resident.transferred',
          entityType: 'resident',
          entityId: residentId,
          metadata: {
            previousBedId: resident.bedId,
            newBedId,
          } as any,
        },
      });

      await tx.idempotencyRecord.create({
        data: {
          key: idempotencyKey,
          response: {
            residentId: updated.id,
            previousBedId: resident.bedId,
            newBedId,
          } as any,
        },
      });

      return updated;
    });

    return result;
  }

  async searchResidents(
    orgId: string,
    query: SearchResidentsDto,
  ): Promise<PaginatedResult<any>> {
    const { page, pageSize, skip, take } = parsePagination({
      page: query.page,
      pageSize: query.pageSize,
    });

    const where: Prisma.ResidentWhereInput = {
      organizationId: orgId,
    };

    if (query.q) {
      const term = query.q.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.wingId || query.roomId || query.floor !== undefined) {
      const bedWhere: Prisma.BedWhereInput = {};
      const roomWhere: Prisma.RoomWhereInput = {};

      if (query.wingId) {
        roomWhere.wingId = query.wingId;
      }
      if (query.roomId) {
        roomWhere.id = query.roomId;
      }
      if (query.floor !== undefined) {
        roomWhere.floor = query.floor;
      }

      bedWhere.room = roomWhere;
      where.bed = bedWhere;
    }

    const [items, total] = await Promise.all([
      this.prisma.resident.findMany({
        where,
        skip,
        take,
        orderBy: { fullName: 'asc' },
        include: {
          bed: {
            include: {
              room: {
                include: { wing: true },
              },
            },
          },
        },
      }),
      this.prisma.resident.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
