import './common/bigint-json-patch';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { PropertyModule } from './property/property.module';
import { ResidentModule } from './resident/resident.module';
import { BillingModule } from './billing/billing.module';
import { NotificationModule } from './notification/notification.module';
import { ReportModule } from './report/report.module';
import { FileModule } from './file/file.module';
import { AuditModule } from './audit/audit.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OrganizationModule,
    PropertyModule,
    ResidentModule,
    BillingModule,
    NotificationModule,
    ReportModule,
    FileModule,
    AuditModule,
    DashboardModule,
    HealthModule,
  ],
})
export class AppModule {}
