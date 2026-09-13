import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  Injectable,
  CanActivate,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { StaffCapability } from './capabilities';

export interface RequestUser {
  id: string;
  organizationId: string;
  role: string;
  /** Only meaningful for role 'staff' — an 'owner' bypasses every
   * capability check regardless of this array's contents. */
  permissions: string[];
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof RequestUser | undefined,
    ctx: ExecutionContext,
  ): RequestUser | RequestUser[keyof RequestUser] => {
    const request = ctx.switchToHttp().getRequest();
    const user: RequestUser = request.user;
    return data ? user[data] : user;
  },
);

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: RequestUser = request.user;

    if (!user) {
      return false;
    }

    return requiredRoles.includes(user.role as UserRole);
  }
}

export const CAPABILITY_KEY = 'capabilities';

/** Gate an endpoint behind one or more of the fixed staff capabilities
 * (see common/capabilities.ts). An 'owner' always passes; a 'staff' user
 * must have every listed capability in their `permissions` array. */
export const RequireCapability = (...capabilities: StaffCapability[]) =>
  SetMetadata(CAPABILITY_KEY, capabilities);

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<StaffCapability[]>(
      CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: RequestUser = request.user;

    if (!user) {
      return false;
    }

    // Owners implicitly have every capability — the permissions array is
    // staff-only bookkeeping and is never consulted for an owner.
    if (user.role === 'owner') {
      return true;
    }

    const granted = user.permissions ?? [];
    return required.every((cap) => granted.includes(cap));
  }
}
