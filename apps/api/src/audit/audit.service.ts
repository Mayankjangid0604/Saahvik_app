import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parsePagination, PaginationQuery } from '../common/pagination';

@Injectable()
export class AuditService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async log(
    orgId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        action,
        entityType,
        entityId: entityId || null,
        metadata: (metadata ?? undefined) as any,
      },
    });
  }

  async getAuditLogs(
    orgId: string,
    query: PaginationQuery & {
      entityType?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const { page, pageSize, skip, take } = parsePagination(query);

    const where: Record<string, unknown> = { organizationId: orgId };

    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.startDate || query.endDate) {
      const createdAt: Record<string, Date> = {};
      if (query.startDate) createdAt.gte = new Date(query.startDate);
      if (query.endDate) createdAt.lte = new Date(query.endDate);
      where.createdAt = createdAt;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
