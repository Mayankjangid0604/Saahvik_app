import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BedStatus, ResidentStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';

@Injectable()
export class ReportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getOccupancyReport(orgId: string) {
    const property = await this.prisma.property.findFirst({
      where: { organizationId: orgId },
    });
    if (!property) {
      return { totalBeds: 0, occupied: 0, vacant: 0, maintenance: 0, byWing: [], byFloor: [] };
    }

    // Overall counts
    const bedCounts = await this.prisma.bed.groupBy({
      by: ['status'],
      where: { room: { propertyId: property.id } },
      _count: { id: true },
    });

    let totalBeds = 0;
    let occupied = 0;
    let vacant = 0;
    let maintenance = 0;
    for (const row of bedCounts) {
      const count = row._count.id;
      totalBeds += count;
      if (row.status === BedStatus.occupied) occupied = count;
      else if (row.status === BedStatus.vacant) vacant = count;
      else if (row.status === BedStatus.maintenance) maintenance = count;
    }

    // By wing
    const wings = await this.prisma.wing.findMany({
      where: { propertyId: property.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const byWing = await Promise.all(
      wings.map(async (wing) => {
        const counts = await this.prisma.bed.groupBy({
          by: ['status'],
          where: { room: { wingId: wing.id } },
          _count: { id: true },
        });
        let wingTotal = 0;
        let wingOccupied = 0;
        let wingVacant = 0;
        for (const row of counts) {
          wingTotal += row._count.id;
          if (row.status === BedStatus.occupied) wingOccupied = row._count.id;
          else if (row.status === BedStatus.vacant) wingVacant = row._count.id;
        }
        return {
          wingName: wing.name,
          total: wingTotal,
          occupied: wingOccupied,
          vacant: wingVacant,
        };
      }),
    );

    // By floor
    const rooms = await this.prisma.room.findMany({
      where: { propertyId: property.id },
      select: { id: true, floor: true },
    });

    const floorSet = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
    const roomsByFloor = new Map<number, string[]>();
    for (const room of rooms) {
      if (!roomsByFloor.has(room.floor)) roomsByFloor.set(room.floor, []);
      roomsByFloor.get(room.floor)!.push(room.id);
    }

    const byFloor = await Promise.all(
      floorSet.map(async (floor) => {
        const roomIds = roomsByFloor.get(floor) || [];
        if (roomIds.length === 0) return { floor, total: 0, occupied: 0, vacant: 0 };

        const counts = await this.prisma.bed.groupBy({
          by: ['status'],
          where: { roomId: { in: roomIds } },
          _count: { id: true },
        });
        let floorTotal = 0;
        let floorOccupied = 0;
        let floorVacant = 0;
        for (const row of counts) {
          floorTotal += row._count.id;
          if (row.status === BedStatus.occupied) floorOccupied = row._count.id;
          else if (row.status === BedStatus.vacant) floorVacant = row._count.id;
        }
        return { floor, total: floorTotal, occupied: floorOccupied, vacant: floorVacant };
      }),
    );

    return {
      totalBeds,
      occupied,
      vacant,
      maintenance,
      occupancyRate: totalBeds > 0 ? Number(((occupied / totalBeds) * 100).toFixed(2)) : 0,
      byWing,
      byFloor,
    };
  }

  async getDuesReport(
    orgId: string,
    filters?: { settled?: boolean; residentId?: string },
  ) {
    const where: Record<string, unknown> = {
      resident: { organizationId: orgId },
    };
    if (filters?.settled !== undefined) where.settled = filters.settled;
    if (filters?.residentId) where.residentId = filters.residentId;

    const dues = await this.prisma.dues.findMany({
      where,
      include: {
        resident: {
          select: {
            id: true,
            fullName: true,
            phone: true,
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
        },
      },
      orderBy: { dueSince: 'asc' },
    });

    // Aggregate per resident
    const residentMap = new Map<
      string,
      {
        residentId: string;
        fullName: string;
        phone: string | null;
        bedLabel: string | null;
        roomNumber: string | null;
        wingName: string | null;
        totalDuePaisa: bigint;
        duesCount: number;
        oldestDueSince: Date;
      }
    >();

    for (const d of dues) {
      const existing = residentMap.get(d.residentId);
      if (existing) {
        existing.totalDuePaisa += d.amountDuePaisa;
        existing.duesCount += 1;
        if (d.dueSince < existing.oldestDueSince)
          existing.oldestDueSince = d.dueSince;
      } else {
        residentMap.set(d.residentId, {
          residentId: d.residentId,
          fullName: d.resident.fullName,
          phone: d.resident.phone,
          bedLabel: d.resident.bed?.bedLabel || null,
          roomNumber: d.resident.bed?.room.roomNumber || null,
          wingName: d.resident.bed?.room.wing?.name || null,
          totalDuePaisa: d.amountDuePaisa,
          duesCount: 1,
          oldestDueSince: d.dueSince,
        });
      }
    }

    const items = Array.from(residentMap.values()).map((r) => ({
      ...r,
      totalDuePaisa: r.totalDuePaisa.toString(),
    }));

    return { items, totalResidents: items.length };
  }

  async getResidentListReport(
    orgId: string,
    filters?: { status?: ResidentStatus },
  ) {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (filters?.status) where.status = filters.status;

    const residents = await this.prisma.resident.findMany({
      where,
      include: {
        bed: {
          select: {
            bedLabel: true,
            room: {
              select: {
                roomNumber: true,
                floor: true,
                wing: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    return residents.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      phone: r.phone,
      email: r.email,
      status: r.status,
      admissionDate: r.admissionDate,
      vacateDate: r.vacateDate,
      bedLabel: r.bed?.bedLabel || null,
      roomNumber: r.bed?.room.roomNumber || null,
      floor: r.bed?.room.floor ?? null,
      wingName: r.bed?.room.wing?.name || null,
    }));
  }

  async getMonthlyCollectionReport(orgId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const payments = await this.prisma.payment.findMany({
      where: {
        resident: { organizationId: orgId },
        paidOn: { gte: startDate, lt: endDate },
      },
      include: {
        resident: { select: { fullName: true } },
      },
      orderBy: { paidOn: 'asc' },
    });

    let totalCollectedPaisa = BigInt(0);
    const byMethod: Record<string, bigint> = {};
    const byDay: Record<string, bigint> = {};

    for (const p of payments) {
      totalCollectedPaisa += p.amountPaisa;

      const method = p.method;
      byMethod[method] = (byMethod[method] || BigInt(0)) + p.amountPaisa;

      const dayKey = p.paidOn.toISOString().split('T')[0];
      byDay[dayKey] = (byDay[dayKey] || BigInt(0)) + p.amountPaisa;
    }

    // Convert BigInts to strings for JSON serialization
    const byMethodStr: Record<string, string> = {};
    for (const [k, v] of Object.entries(byMethod)) {
      byMethodStr[k] = v.toString();
    }
    const byDayStr: Record<string, string> = {};
    for (const [k, v] of Object.entries(byDay)) {
      byDayStr[k] = v.toString();
    }

    return {
      month,
      year,
      totalCollectedPaisa: totalCollectedPaisa.toString(),
      totalPayments: payments.length,
      byMethod: byMethodStr,
      byDay: byDayStr,
      payments: payments.map((p) => ({
        id: p.id,
        residentName: p.resident.fullName,
        amountPaisa: p.amountPaisa.toString(),
        method: p.method,
        paidOn: p.paidOn,
        notes: p.notes,
      })),
    };
  }

  async exportReportPdf(
    reportType: string,
    data: Record<string, unknown>,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Uint8Array[] = [];

      doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      const title = this.getReportTitle(reportType);
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, { align: 'right' });
      doc.moveDown();

      // Content based on report type
      doc.fontSize(12);

      if (reportType === 'occupancy') {
        this.renderOccupancyPdf(doc, data);
      } else if (reportType === 'dues') {
        this.renderDuesPdf(doc, data);
      } else if (reportType === 'residents') {
        this.renderResidentsPdf(doc, data);
      } else if (reportType === 'monthly-collection') {
        this.renderCollectionPdf(doc, data);
      } else {
        doc.text(JSON.stringify(data, null, 2));
      }

      doc.end();
    });
  }

  private getReportTitle(reportType: string): string {
    const titles: Record<string, string> = {
      occupancy: 'Occupancy Report',
      dues: 'Dues Report',
      residents: 'Resident List Report',
      'monthly-collection': 'Monthly Collection Report',
    };
    return titles[reportType] || 'Report';
  }

  private renderOccupancyPdf(doc: any, data: Record<string, unknown>) {
    const d = data as {
      totalBeds: number;
      occupied: number;
      vacant: number;
      maintenance: number;
      occupancyRate: number;
      byWing: { wingName: string; total: number; occupied: number; vacant: number }[];
      byFloor: { floor: number; total: number; occupied: number; vacant: number }[];
    };
    doc.text(`Total Beds: ${d.totalBeds}`);
    doc.text(`Occupied: ${d.occupied}`);
    doc.text(`Vacant: ${d.vacant}`);
    doc.text(`Maintenance: ${d.maintenance}`);
    doc.text(`Occupancy Rate: ${d.occupancyRate}%`);
    doc.moveDown();

    if (d.byWing?.length) {
      doc.fontSize(14).text('By Wing', { underline: true });
      doc.fontSize(12);
      for (const w of d.byWing) {
        doc.text(`  ${w.wingName}: ${w.occupied}/${w.total} occupied, ${w.vacant} vacant`);
      }
      doc.moveDown();
    }

    if (d.byFloor?.length) {
      doc.fontSize(14).text('By Floor', { underline: true });
      doc.fontSize(12);
      for (const f of d.byFloor) {
        doc.text(`  Floor ${f.floor}: ${f.occupied}/${f.total} occupied, ${f.vacant} vacant`);
      }
    }
  }

  private renderDuesPdf(doc: any, data: Record<string, unknown>) {
    const d = data as {
      items: {
        fullName: string;
        totalDuePaisa: string;
        duesCount: number;
        roomNumber: string | null;
        wingName: string | null;
      }[];
      totalResidents: number;
    };
    doc.text(`Total Residents with Dues: ${d.totalResidents}`);
    doc.moveDown();

    for (const item of d.items) {
      const location = [item.roomNumber, item.wingName].filter(Boolean).join(', ');
      const amountRupees = (Number(item.totalDuePaisa) / 100).toFixed(2);
      doc.text(
        `${item.fullName} - Rs ${amountRupees} (${item.duesCount} dues)${location ? ` - ${location}` : ''}`,
      );
    }
  }

  private renderResidentsPdf(doc: any, data: Record<string, unknown>) {
    const items = (Array.isArray(data) ? data : []) as {
      fullName: string;
      phone: string | null;
      status: string;
      roomNumber: string | null;
      bedLabel: string | null;
      wingName: string | null;
    }[];
    for (const res of items) {
      const location = [res.bedLabel, res.roomNumber, res.wingName]
        .filter(Boolean)
        .join(', ');
      doc.text(`${res.fullName} | ${res.phone || 'N/A'} | ${res.status} | ${location || 'N/A'}`);
    }
  }

  private renderCollectionPdf(doc: any, data: Record<string, unknown>) {
    const d = data as {
      month: number;
      year: number;
      totalCollectedPaisa: string;
      totalPayments: number;
      byMethod: Record<string, string>;
    };
    const totalRupees = (Number(d.totalCollectedPaisa) / 100).toFixed(2);
    doc.text(`Period: ${d.month}/${d.year}`);
    doc.text(`Total Collected: Rs ${totalRupees}`);
    doc.text(`Total Payments: ${d.totalPayments}`);
    doc.moveDown();

    if (d.byMethod) {
      doc.fontSize(14).text('By Payment Method', { underline: true });
      doc.fontSize(12);
      for (const [method, amount] of Object.entries(d.byMethod)) {
        doc.text(`  ${method}: Rs ${(Number(amount) / 100).toFixed(2)}`);
      }
    }
  }

  async exportReportExcel(
    reportType: string,
    data: Record<string, unknown> | unknown[],
  ): Promise<Buffer> {
    const wb = XLSX.utils.book_new();

    let rows: Record<string, unknown>[];

    if (reportType === 'occupancy') {
      const d = data as {
        totalBeds: number;
        occupied: number;
        vacant: number;
        maintenance: number;
        occupancyRate: number;
        byWing: { wingName: string; total: number; occupied: number; vacant: number }[];
        byFloor: { floor: number; total: number; occupied: number; vacant: number }[];
      };
      // Summary sheet
      const summaryRows = [
        { Metric: 'Total Beds', Value: d.totalBeds },
        { Metric: 'Occupied', Value: d.occupied },
        { Metric: 'Vacant', Value: d.vacant },
        { Metric: 'Maintenance', Value: d.maintenance },
        { Metric: 'Occupancy Rate (%)', Value: d.occupancyRate },
      ];
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      if (d.byWing?.length) {
        const wingSheet = XLSX.utils.json_to_sheet(
          d.byWing.map((w) => ({
            Wing: w.wingName,
            Total: w.total,
            Occupied: w.occupied,
            Vacant: w.vacant,
          })),
        );
        XLSX.utils.book_append_sheet(wb, wingSheet, 'By Wing');
      }

      if (d.byFloor?.length) {
        const floorSheet = XLSX.utils.json_to_sheet(
          d.byFloor.map((f) => ({
            Floor: f.floor,
            Total: f.total,
            Occupied: f.occupied,
            Vacant: f.vacant,
          })),
        );
        XLSX.utils.book_append_sheet(wb, floorSheet, 'By Floor');
      }

      return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }

    if (reportType === 'dues') {
      const d = data as {
        items: {
          fullName: string;
          phone: string | null;
          totalDuePaisa: string;
          duesCount: number;
          roomNumber: string | null;
          wingName: string | null;
          oldestDueSince: Date;
        }[];
      };
      rows = d.items.map((i) => ({
        Name: i.fullName,
        Phone: i.phone || '',
        'Total Due (Rs)': (Number(i.totalDuePaisa) / 100).toFixed(2),
        'Dues Count': i.duesCount,
        Room: i.roomNumber || '',
        Wing: i.wingName || '',
        'Oldest Due Since': i.oldestDueSince,
      }));
    } else if (reportType === 'residents') {
      const residents = (Array.isArray(data) ? data : []) as {
        fullName: string;
        phone: string | null;
        email: string | null;
        status: string;
        admissionDate: Date;
        bedLabel: string | null;
        roomNumber: string | null;
        floor: number | null;
        wingName: string | null;
      }[];
      rows = residents.map((r) => ({
        Name: r.fullName,
        Phone: r.phone || '',
        Email: r.email || '',
        Status: r.status,
        'Admission Date': r.admissionDate,
        Bed: r.bedLabel || '',
        Room: r.roomNumber || '',
        Floor: r.floor ?? '',
        Wing: r.wingName || '',
      }));
    } else if (reportType === 'monthly-collection') {
      const d = data as {
        payments: {
          residentName: string;
          amountPaisa: string;
          method: string;
          paidOn: Date;
          notes: string | null;
        }[];
      };
      rows = d.payments.map((p) => ({
        Resident: p.residentName,
        'Amount (Rs)': (Number(p.amountPaisa) / 100).toFixed(2),
        Method: p.method,
        'Paid On': p.paidOn,
        Notes: p.notes || '',
      }));
    } else {
      throw new BadRequestException(`Unknown report type: ${reportType}`);
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}
