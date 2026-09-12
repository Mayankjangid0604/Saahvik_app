import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BedStatus, ResidentStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getDashboardSummary(orgId: string) {
    // Total residents (active)
    const totalResidents = await this.prisma.resident.count({
      where: { organizationId: orgId, status: ResidentStatus.active },
    });

    // Total beds and occupied
    const property = await this.prisma.property.findFirst({
      where: { organizationId: orgId },
      select: { id: true },
    });

    let totalBeds = 0;
    let occupiedBeds = 0;

    if (property) {
      const bedCounts = await this.prisma.bed.groupBy({
        by: ['status'],
        where: { room: { propertyId: property.id } },
        _count: { id: true },
      });

      for (const row of bedCounts) {
        totalBeds += row._count.id;
        if (row.status === BedStatus.occupied) occupiedBeds = row._count.id;
      }
    }

    const occupancyRate =
      totalBeds > 0
        ? Number(((occupiedBeds / totalBeds) * 100).toFixed(2))
        : 0;

    // Total outstanding dues (unsettled)
    const duesAgg = await this.prisma.dues.aggregate({
      where: {
        resident: { organizationId: orgId },
        settled: false,
      },
      _sum: { amountDuePaisa: true },
    });
    const totalDuesPaisa = (duesAgg._sum.amountDuePaisa || BigInt(0)).toString();

    // Total collected this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const collectionAgg = await this.prisma.payment.aggregate({
      where: {
        resident: { organizationId: orgId },
        paidOn: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amountPaisa: true },
    });
    const totalCollectedThisMonthPaisa = (
      collectionAgg._sum.amountPaisa || BigInt(0)
    ).toString();

    // Recent admissions (last 5)
    const recentAdmissions = await this.prisma.resident.findMany({
      where: {
        organizationId: orgId,
        status: ResidentStatus.active,
      },
      select: {
        id: true,
        fullName: true,
        admissionDate: true,
        bed: {
          select: {
            bedLabel: true,
            room: {
              select: {
                roomNumber: true,
                wing: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { admissionDate: 'desc' },
      take: 5,
    });

    // Recent payments (last 5)
    const recentPayments = await this.prisma.payment.findMany({
      where: {
        resident: { organizationId: orgId },
      },
      select: {
        id: true,
        amountPaisa: true,
        method: true,
        paidOn: true,
        resident: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      totalResidents,
      totalBeds,
      occupancyRate,
      totalDuesPaisa,
      totalCollectedThisMonthPaisa,
      recentAdmissions: recentAdmissions.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        admissionDate: r.admissionDate,
        bedLabel: r.bed?.bedLabel || null,
        roomNumber: r.bed?.room.roomNumber || null,
        wingName: r.bed?.room.wing?.name || null,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        residentName: p.resident.fullName,
        amountPaisa: p.amountPaisa.toString(),
        method: p.method,
        paidOn: p.paidOn,
      })),
    };
  }
}
