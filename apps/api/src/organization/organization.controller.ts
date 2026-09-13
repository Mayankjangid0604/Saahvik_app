import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators';
import { wrapSuccess } from '../common/response';
import { IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { RequestUser } from '../common/decorators';
import { STAFF_CAPABILITIES } from '../common/capabilities';
import * as bcrypt from 'bcrypt';

class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;
}

class AddStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class UpdateStaffPermissionsDto {
  @IsArray()
  @IsIn(STAFF_CAPABILITIES, { each: true })
  permissions!: string[];
}

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(
    @Inject(OrganizationService)
    private readonly organizationService: OrganizationService,
  ) {}

  @Get('me')
  async getMyOrganization(@CurrentUser() user: RequestUser) {
    const org = await this.organizationService.getMyOrganization(user.organizationId);
    return wrapSuccess(org, 'v1');
  }

  @Patch('me')
  async updateOrganization(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    if (user.role !== 'owner') {
      throw new ForbiddenException('Only owners can update organization settings');
    }
    const org = await this.organizationService.updateOrganization(user.organizationId, dto);
    return wrapSuccess(org, 'v1');
  }

  @Get('me/staff')
  async getStaff(@CurrentUser() user: RequestUser) {
    if (user.role !== 'owner') {
      throw new ForbiddenException('Only owners can manage staff');
    }
    const staff = await this.organizationService.getStaffMembers(user.organizationId);
    return wrapSuccess(staff, 'v1');
  }

  @Post('me/staff')
  async addStaff(
    @CurrentUser() user: RequestUser,
    @Body() dto: AddStaffDto,
  ) {
    if (user.role !== 'owner') {
      throw new ForbiddenException('Only owners can add staff');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const staff = await this.organizationService.addStaff(
      user.organizationId,
      dto.email,
      dto.name,
      passwordHash,
    );
    return wrapSuccess(
      {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        permissions: staff.permissions,
      },
      'v1',
    );
  }

  @Delete('me/staff/:staffId')
  async removeStaff(
    @CurrentUser() user: RequestUser,
    @Param('staffId') staffId: string,
  ) {
    if (user.role !== 'owner') {
      throw new ForbiddenException('Only owners can remove staff');
    }
    await this.organizationService.removeStaff(user.organizationId, staffId);
    return wrapSuccess({ deleted: true }, 'v1');
  }

  // Deliberately NOT delegable via the staff capability system — editing
  // another staff member's own permissions is a privilege-escalation risk,
  // so this stays a hard owner-only action like add/remove staff above.
  @Patch('me/staff/:staffId/permissions')
  async updateStaffPermissions(
    @CurrentUser() user: RequestUser,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffPermissionsDto,
  ) {
    if (user.role !== 'owner') {
      throw new ForbiddenException('Only owners can edit staff permissions');
    }
    const staff = await this.organizationService.updateStaffPermissions(
      user.organizationId,
      staffId,
      dto.permissions,
      user.id,
    );
    return wrapSuccess(staff, 'v1');
  }

  @Post('me/cancel')
  async cancelSubscription(@CurrentUser() user: RequestUser) {
    if (user.role !== 'owner') {
      throw new ForbiddenException('Only owners can cancel the subscription');
    }
    const org = await this.organizationService.cancelSubscription(user.organizationId);
    return wrapSuccess(org, 'v1');
  }

  @Post('me/reactivate')
  async reactivateSubscription(@CurrentUser() user: RequestUser) {
    if (user.role !== 'owner') {
      throw new ForbiddenException('Only owners can reactivate the subscription');
    }
    const org = await this.organizationService.reactivateSubscription(user.organizationId);
    return wrapSuccess(org, 'v1');
  }
}
