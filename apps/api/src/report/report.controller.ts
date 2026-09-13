import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Inject,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser, RequestUser, RequireCapability, CapabilityGuard } from '../common/decorators';
import { wrapSuccess } from '../common/response';
import { ResidentStatus } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard, CapabilityGuard)
export class ReportController {
  constructor(
    @Inject(ReportService) private readonly reportService: ReportService,
  ) {}

  @Get('occupancy')
  @RequireCapability('reports:view')
  async getOccupancy(@CurrentUser() user: RequestUser) {
    const data = await this.reportService.getOccupancyReport(user.organizationId);
    return wrapSuccess(data, 'v1');
  }

  @Get('dues')
  @RequireCapability('reports:view')
  async getDues(
    @CurrentUser() user: RequestUser,
    @Query('settled') settled?: string,
    @Query('residentId') residentId?: string,
  ) {
    const filters: { settled?: boolean; residentId?: string } = {};
    if (settled === 'true') filters.settled = true;
    else if (settled === 'false') filters.settled = false;
    if (residentId) filters.residentId = residentId;

    const data = await this.reportService.getDuesReport(user.organizationId, filters);
    return wrapSuccess(data, 'v1');
  }

  @Get('residents')
  @RequireCapability('reports:view')
  async getResidents(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    const filters: { status?: ResidentStatus } = {};
    if (status && Object.values(ResidentStatus).includes(status as ResidentStatus)) {
      filters.status = status as ResidentStatus;
    }

    const data = await this.reportService.getResidentListReport(user.organizationId, filters);
    return wrapSuccess(data, 'v1');
  }

  @Get('monthly-collection')
  @RequireCapability('reports:view')
  async getMonthlyCollection(
    @CurrentUser() user: RequestUser,
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const now = new Date();
    const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    if (month < 1 || month > 12 || isNaN(month)) {
      throw new BadRequestException('Invalid month. Must be 1-12.');
    }
    if (year < 2000 || year > 2100 || isNaN(year)) {
      throw new BadRequestException('Invalid year.');
    }

    const data = await this.reportService.getMonthlyCollectionReport(
      user.organizationId,
      month,
      year,
    );
    return wrapSuccess(data, 'v1');
  }

  @Get(':reportType/export')
  @RequireCapability('reports:export')
  async exportReport(
    @CurrentUser() user: RequestUser,
    @Param('reportType') reportType: string,
    @Query('format') format: string,
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
    @Query('settled') settled?: string,
    @Query('status') status?: string,
    @Res() res?: Response,
  ) {
    const validTypes = ['occupancy', 'dues', 'residents', 'monthly-collection'];
    if (!validTypes.includes(reportType)) {
      throw new BadRequestException(
        `Invalid report type. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    if (!format || !['pdf', 'excel'].includes(format)) {
      throw new BadRequestException('format query param must be pdf or excel');
    }

    // Fetch report data
    let data: unknown;
    if (reportType === 'occupancy') {
      data = await this.reportService.getOccupancyReport(user.organizationId);
    } else if (reportType === 'dues') {
      const filters: { settled?: boolean } = {};
      if (settled === 'true') filters.settled = true;
      else if (settled === 'false') filters.settled = false;
      data = await this.reportService.getDuesReport(user.organizationId, filters);
    } else if (reportType === 'residents') {
      const filters: { status?: ResidentStatus } = {};
      if (status && Object.values(ResidentStatus).includes(status as ResidentStatus)) {
        filters.status = status as ResidentStatus;
      }
      data = await this.reportService.getResidentListReport(user.organizationId, filters);
    } else if (reportType === 'monthly-collection') {
      const now = new Date();
      const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
      const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
      data = await this.reportService.getMonthlyCollectionReport(
        user.organizationId,
        month,
        year,
      );
    }

    const filename = `${reportType}-report-${Date.now()}`;

    if (format === 'pdf') {
      const buffer = await this.reportService.exportReportPdf(
        reportType,
        data as Record<string, unknown>,
      );
      res!.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        'Content-Length': buffer.length,
      });
      res!.end(buffer);
    } else {
      const buffer = await this.reportService.exportReportExcel(
        reportType,
        data as Record<string, unknown>,
      );
      res!.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        'Content-Length': buffer.length,
      });
      res!.end(buffer);
    }
  }
}
