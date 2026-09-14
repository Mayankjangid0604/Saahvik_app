import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorCodes } from '../common/error-codes';
import { StaffCapability, isStaffCapability, DEFAULT_STAFF_CAPABILITIES } from '../common/capabilities';

@Injectable()
export class OrganizationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMyOrganization(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }
    return org;
  }

  async updateOrganization(
    orgId: string,
    data: {
      name?: string;
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
    },
  ) {
    return this.prisma.organization.update({
      where: { id: orgId },
      data,
    });
  }

  async addStaff(orgId: string, email: string, name: string, passwordHash: string) {
    return this.prisma.user.create({
      data: {
        organizationId: orgId,
        email,
        passwordHash,
        name,
        role: 'staff',
        emailVerified: true,
        // Explicit rather than relying on the Prisma column default, so
        // there is exactly one source of truth for "what a new staff
        // member starts with" — the column default previously drifted out
        // of sync with this constant (it never included files:manage after
        // that capability was added) since nothing actually read it.
        permissions: DEFAULT_STAFF_CAPABILITIES,
      },
    });
  }

  async removeStaff(orgId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, role: 'staff' },
    });
    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async getStaffMembers(orgId: string) {
    return this.prisma.user.findMany({
      where: { organizationId: orgId, role: 'staff' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        permissions: true,
        createdAt: true,
      },
    });
  }

  async updateStaffPermissions(
    orgId: string,
    staffId: string,
    permissions: string[],
    actingUserId: string,
  ) {
    const invalid = permissions.filter((p) => !isStaffCapability(p));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown capability value(s): ${invalid.join(', ')}`,
      );
    }

    const staff = await this.prisma.user.findFirst({
      where: { id: staffId, organizationId: orgId, role: 'staff' },
    });
    if (!staff) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    const updated = await this.prisma.user.update({
      where: { id: staffId },
      data: { permissions: permissions as StaffCapability[] },
      select: { id: true, email: true, name: true, role: true, permissions: true },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: actingUserId,
        action: 'staff.permissions_updated',
        entityType: 'user',
        entityId: staffId,
        metadata: { permissions } as any,
      },
    });

    return updated;
  }

  async cancelSubscription(orgId: string) {
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: { cancelledAt: new Date() },
    });
    return org;
  }

  async reactivateSubscription(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }
    if (org.dataWipedAt) {
      throw new BadRequestException(
        'This organization\'s personal data has already been wiped following its 30-day cancellation grace period and cannot be reactivated.',
      );
    }
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { cancelledAt: null },
    });
  }
}
