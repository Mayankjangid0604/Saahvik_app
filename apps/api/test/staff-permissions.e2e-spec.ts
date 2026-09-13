import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/http-exception.filter';

/**
 * Phase 3: the owner can grant or revoke a fixed set of capabilities per
 * staff member (a deliberate, disclosed override of the SRS's default
 * fixed owner/staff model for this tier — see DEVIATIONS.md). This proves
 * the full real flow: a staff member without a capability is denied, the
 * owner grants it via the real API, and the same staff member (same JWT,
 * no re-login) is immediately allowed — proving permissions are read fresh
 * per request rather than baked into the token.
 */
describe('Staff Permissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function verifyEmailAndLogin(email: string, password: string): Promise<string> {
    const otpRecord = await prisma.emailOtp.findFirst({
      where: { email, verified: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!otpRecord) throw new Error(`No OTP found for ${email}`);

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email-otp')
      .send({ email, otp: otpRecord.otp })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);

    return loginRes.body.data.accessToken;
  }

  let ownerToken: string;
  let staffToken: string;
  let staffId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    const ownerEmail = `owner-perm-${Date.now()}@example.com`;
    const ownerPassword = 'Passw0rd!123';

    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        email: ownerEmail,
        password: ownerPassword,
        name: 'Perm Test Owner',
        orgName: 'Perm Test Hostel',
      })
      .expect(201);

    ownerToken = await verifyEmailAndLogin(ownerEmail, ownerPassword);

    const staffEmail = `staff-perm-${Date.now()}@example.com`;
    const staffPassword = 'Passw0rd!123';
    const addStaffRes = await request(app.getHttpServer())
      .post('/api/v1/organizations/me/staff')
      .set(authed(ownerToken))
      .send({ email: staffEmail, name: 'Perm Test Staff', password: staffPassword })
      .expect(201);
    staffId = addStaffRes.body.data.id;

    const staffLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/staff-login')
      .send({ email: staffEmail, password: staffPassword })
      .expect(201);
    staffToken = staffLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('a new staff member has the default capability set (matches pre-Phase-3 behavior)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/organizations/me/staff')
      .set(authed(ownerToken))
      .expect(200);
    const staff = res.body.data.find((s: { id: string }) => s.id === staffId);
    expect(staff.permissions).toEqual(
      expect.arrayContaining(['residents:manage', 'payments:record']),
    );
    expect(staff.permissions).not.toContain('billing:manage_fee_structure');
    expect(staff.permissions).not.toContain('audit:view');
  });

  it('staff without billing:manage_fee_structure cannot set a fee structure', async () => {
    // Create a resident as owner first (residents:manage is a default staff
    // capability, but fee-structure is not — that's exactly the boundary
    // this test proves).
    const roomsRes = await request(app.getHttpServer())
      .post('/api/v1/properties/me/rooms')
      .set(authed(ownerToken))
      .send({ rooms: [{ roomNumber: '201', floor: 2 }] });
    const listRoomsRes = await request(app.getHttpServer())
      .get('/api/v1/properties/me/rooms')
      .set(authed(ownerToken))
      .expect(200);
    const roomId = listRoomsRes.body.data.items.find(
      (r: { roomNumber: string }) => r.roomNumber === '201',
    ).id;
    void roomsRes;

    await request(app.getHttpServer())
      .post(`/api/v1/properties/me/rooms/${roomId}/beds`)
      .set(authed(ownerToken))
      .send({ beds: [{ bedLabel: 'A' }] })
      .expect(201);
    const bedsRes = await request(app.getHttpServer())
      .get(`/api/v1/properties/me/rooms/${roomId}/beds`)
      .set(authed(ownerToken))
      .expect(200);
    const bedId = bedsRes.body.data[0].id;

    const residentRes = await request(app.getHttpServer())
      .post('/api/v1/residents')
      .set(authed(ownerToken))
      .set('Idempotency-Key', `perm-test-admit-${Date.now()}`)
      .send({
        fullName: 'Perm Test Resident',
        admissionDate: '2026-01-01',
        bedId,
        guardians: [{ fullName: 'Guardian', phone: '9999999999', relationship: 'Father' }],
      })
      .expect(201);
    const residentId = residentRes.body.data.id;

    const deniedRes = await request(app.getHttpServer())
      .post(`/api/v1/residents/${residentId}/fee-structure`)
      .set(authed(staffToken))
      .send({ monthlyRentPaisa: '500000', effectiveFrom: '2026-01-01' });
    expect(deniedRes.status).toBe(403);

    // Owner grants the capability — no new login, same staff JWT.
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/me/staff/${staffId}/permissions`)
      .set(authed(ownerToken))
      .send({
        permissions: [
          'residents:manage',
          'payments:record',
          'reports:view',
          'reports:export',
          'notifications:send',
          'billing:manage_fee_structure',
        ],
      })
      .expect(200);

    const allowedRes = await request(app.getHttpServer())
      .post(`/api/v1/residents/${residentId}/fee-structure`)
      .set(authed(staffToken))
      .send({ monthlyRentPaisa: '500000', effectiveFrom: '2026-01-01' });
    expect(allowedRes.status).toBe(201);
  });

  it('staff cannot view the audit log by default, and a staff member cannot grant themselves permissions', async () => {
    const auditRes = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set(authed(staffToken));
    expect(auditRes.status).toBe(403);

    const selfGrantRes = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/me/staff/${staffId}/permissions`)
      .set(authed(staffToken))
      .send({ permissions: ['audit:view'] });
    expect(selfGrantRes.status).toBe(403);
  });

  it('rejects an unknown capability value', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/me/staff/${staffId}/permissions`)
      .set(authed(ownerToken))
      .send({ permissions: ['not:a_real_capability'] });
    expect(res.status).toBe(400);
  });

  it('owner always passes every capability check regardless of the permissions column', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set(authed(ownerToken));
    expect(res.status).toBe(200);
  });
});
