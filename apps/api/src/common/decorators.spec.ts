import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CapabilityGuard, CAPABILITY_KEY, RequestUser } from './decorators';

function mockContext(user: RequestUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('CapabilityGuard', () => {
  function makeGuard(required: string[] | undefined) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new CapabilityGuard(reflector);
  }

  it('allows the request when the handler requires no capability', () => {
    const guard = makeGuard(undefined);
    const ctx = mockContext({
      id: 'u1',
      organizationId: 'org1',
      role: 'staff',
      permissions: [],
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('always allows an owner, regardless of their permissions array', () => {
    const guard = makeGuard(['audit:view']);
    const ctx = mockContext({
      id: 'u1',
      organizationId: 'org1',
      role: 'owner',
      permissions: [],
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies a staff user missing the required capability', () => {
    const guard = makeGuard(['billing:manage_fee_structure']);
    const ctx = mockContext({
      id: 'u1',
      organizationId: 'org1',
      role: 'staff',
      permissions: ['residents:manage', 'payments:record'],
    });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('allows a staff user who has the required capability', () => {
    const guard = makeGuard(['payments:record']);
    const ctx = mockContext({
      id: 'u1',
      organizationId: 'org1',
      role: 'staff',
      permissions: ['residents:manage', 'payments:record'],
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('requires every listed capability, not just one', () => {
    const guard = makeGuard(['payments:record', 'audit:view']);
    const ctx = mockContext({
      id: 'u1',
      organizationId: 'org1',
      role: 'staff',
      permissions: ['payments:record'],
    });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('denies when there is no authenticated user on the request', () => {
    const guard = makeGuard(['payments:record']);
    const ctx = mockContext(undefined);
    expect(guard.canActivate(ctx)).toBe(false);
  });
});

describe('CAPABILITY_KEY', () => {
  it('is a stable metadata key', () => {
    expect(CAPABILITY_KEY).toBe('capabilities');
  });
});
