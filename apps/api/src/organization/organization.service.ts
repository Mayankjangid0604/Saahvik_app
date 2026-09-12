import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorCodes } from '../common/error-codes';

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
        createdAt: true,
      },
    });
  }
}
