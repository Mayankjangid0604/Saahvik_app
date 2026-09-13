import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';

const CANCELLATION_GRACE_PERIOD_DAYS = 30;

/**
 * Data retention per 12_Security_Data_Privacy_Policy.md §7 and the explicit
 * decision made for this: a vacated-but-still-subscribed resident's photo
 * and ID document remain retained indefinitely (left open, unchanged from
 * today's behavior) — only a full subscription cancellation starts a
 * countdown. 30 days after cancellation, an organization's resident photos
 * and ID documents (sensitive personal data) are deleted from storage.
 *
 * Deliberately NOT touched by this job: payments, dues, fee structures,
 * audit logs, or any other financial/audit record — the policy explicitly
 * treats permanent retention of that data as a separate concern from
 * resident personal-data retention, and this job only ever nulls out
 * photoKey/idDocumentKey plus deletes the underlying files.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FileService) private readonly fileService: FileService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runScheduledWipe() {
    const result = await this.wipeCancelledOrganizations();
    if (result.organizationsWiped > 0) {
      this.logger.log(
        `Retention job wiped personal data for ${result.organizationsWiped} organization(s)`,
      );
    }
  }

  /**
   * Finds every organization whose cancellation grace period has elapsed
   * and has not yet been wiped, deletes each of their residents' stored
   * photo/ID document files, nulls the corresponding DB columns, and marks
   * the organization as wiped. Idempotent — re-running is a no-op for an
   * org already marked `dataWipedAt`.
   */
  async wipeCancelledOrganizations(now: Date = new Date()) {
    const cutoff = new Date(
      now.getTime() - CANCELLATION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );

    const dueOrgs = await this.prisma.organization.findMany({
      where: {
        cancelledAt: { lte: cutoff },
        dataWipedAt: null,
      },
      select: { id: true },
    });

    for (const org of dueOrgs) {
      await this.wipeOrganizationPersonalData(org.id, now);
    }

    return { organizationsWiped: dueOrgs.length };
  }

  private async wipeOrganizationPersonalData(orgId: string, now: Date) {
    const residents = await this.prisma.resident.findMany({
      where: {
        organizationId: orgId,
        OR: [{ photoKey: { not: null } }, { idDocumentKey: { not: null } }],
      },
      select: { id: true, photoKey: true, idDocumentKey: true },
    });

    for (const resident of residents) {
      if (resident.photoKey) {
        await this.deleteFileQuietly(orgId, resident.photoKey);
      }
      if (resident.idDocumentKey) {
        await this.deleteFileQuietly(orgId, resident.idDocumentKey);
      }
      await this.prisma.resident.update({
        where: { id: resident.id },
        data: { photoKey: null, idDocumentKey: null },
      });
    }

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { dataWipedAt: now },
    });
  }

  private async deleteFileQuietly(orgId: string, key: string) {
    try {
      await this.fileService.delete(orgId, key);
    } catch (err) {
      // A file already missing from storage shouldn't block the DB-column
      // wipe (which is the part that actually matters for the retention
      // guarantee) — log and continue.
      this.logger.warn(`Could not delete file ${key} for org ${orgId}: ${err}`);
    }
  }
}
