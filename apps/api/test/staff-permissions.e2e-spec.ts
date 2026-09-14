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

  it('staff without files:manage cannot upload or delete a file, owner grants it, then both succeed', async () => {
    // At this point in the suite staffToken's permissions were last set
    // explicitly (previous test) to a set that does not include
    // files:manage — proving the default-vs-explicit-grant boundary the
    // same way the fee-structure test above does.
    const deniedUpload = await request(app.getHttpServer())
      .post('/api/v1/files/upload')
      .set(authed(staffToken))
      .attach('file', Buffer.from('not-yet-allowed'), 'blocked.txt');
    expect(deniedUpload.status).toBe(403);

    const deniedDelete = await request(app.getHttpServer())
      .delete('/api/v1/files/some-org-id/does-not-matter.txt')
      .set(authed(staffToken));
    expect(deniedDelete.status).toBe(403);

    // Owner grants files:manage — no new login, same staff JWT.
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
          'files:manage',
        ],
      })
      .expect(200);

    const allowedUpload = await request(app.getHttpServer())
      .post('/api/v1/files/upload')
      .set(authed(staffToken))
      .attach('file', Buffer.from('now-allowed'), 'allowed.txt');
    expect(allowedUpload.status).toBe(201);
    const uploadedKey = allowedUpload.body.data.key;

    const allowedDelete = await request(app.getHttpServer())
      .delete(`/api/v1/files/${uploadedKey}`)
      .set(authed(staffToken));
    expect(allowedDelete.status).toBe(200);
  });

  it('owner can upload and delete files regardless of the permissions column', async () => {
    const uploadRes = await request(app.getHttpServer())
      .post('/api/v1/files/upload')
      .set(authed(ownerToken))
      .attach('file', Buffer.from('owner-file'), 'owner.txt');
    expect(uploadRes.status).toBe(201);

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/v1/files/${uploadRes.body.data.key}`)
      .set(authed(ownerToken));
    expect(deleteRes.status).toBe(200);
  });

  it('staff without notifications:send cannot schedule a notification, owner grants it, then succeeds', async () => {
    // At this point in the suite staffToken's permissions include files:manage
    // (set by the previous test) but do NOT include notifications:send —
    // the previous PATCH set permissions explicitly to a list that omitted it.
    // We reset to confirm the boundary.
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/me/staff/${staffId}/permissions`)
      .set(authed(ownerToken))
      .send({
        permissions: [
          'residents:manage',
          'payments:record',
          'reports:view',
          'files:manage',
        ],
      })
      .expect(200);

    const deniedRes = await request(app.getHttpServer())
      .post('/api/v1/notifications/schedule')
      .set(authed(staffToken))
      .send({
        channel: 'email',
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test body',
        scheduledAt: new Date(Date.now() + 60000).toISOString(),
      });
    expect(deniedRes.status).toBe(403);

    // Owner grants notifications:send — no new login, same staff JWT.
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/me/staff/${staffId}/permissions`)
      .set(authed(ownerToken))
      .send({
        permissions: [
          'residents:manage',
          'payments:record',
          'reports:view',
          'files:manage',
          'notifications:send',
        ],
      })
      .expect(200);

    const allowedRes = await request(app.getHttpServer())
      .post('/api/v1/notifications/schedule')
      .set(authed(staffToken))
      .send({
        channel: 'email',
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test body',
        scheduledAt: new Date(Date.now() + 60000).toISOString(),
      });
    expect(allowedRes.status).toBe(201);
  });

  it('owner always passes notifications:send check on schedule route regardless of permissions column', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/notifications/schedule')
      .set(authed(ownerToken))
      .send({
        channel: 'email',
        to: 'test@example.com',
        subject: 'Owner Test',
        body: 'Owner test body',
        scheduledAt: new Date(Date.now() + 60000).toISOString(),
      });
    expect(res.status).toBe(201);
  });

  it('staff without payments:record cannot create a Razorpay order, owner grants it, then succeeds', async () => {
    // Razorpay is a Beginner-plan feature; upgrade the test org so the service
    // check passes and only the capability guard decides the outcome.
    const orgRes = await request(app.getHttpServer())
      .get('/api/v1/organizations/me')
      .set(authed(ownerToken))
      .expect(200);
    await prisma.organization.update({
      where: { id: orgRes.body.data.id },
      data: { subscriptionPlan: 'beginner' },
    });

    // Strip payments:record to prove the boundary — previous test left the
    // permissions with it present, so we need an explicit reset first.
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/me/staff/${staffId}/permissions`)
      .set(authed(ownerToken))
      .send({
        permissions: [
          'residents:manage',
          'reports:view',
          'files:manage',
          'notifications:send',
        ],
      })
      .expect(200);

    // Create a dedicated room+bed so we're not blocked by occupancy from prior tests.
    const ts1 = Date.now();
    await request(app.getHttpServer())
      .post('/api/v1/properties/me/rooms')
      .set(authed(ownerToken))
      .send({ rooms: [{ roomNumber: `RZ1-${ts1}`, floor: 5 }] });
    const listRoomsRes = await request(app.getHttpServer())
      .get('/api/v1/properties/me/rooms')
      .set(authed(ownerToken))
      .expect(200);
    const room = listRoomsRes.body.data.items.find(
      (r: { roomNumber: string }) => r.roomNumber === `RZ1-${ts1}`,
    );
    await request(app.getHttpServer())
      .post(`/api/v1/properties/me/rooms/${room.id}/beds`)
      .set(authed(ownerToken))
      .send({ beds: [{ bedLabel: 'A' }] });
    const bedsRes = await request(app.getHttpServer())
      .get(`/api/v1/properties/me/rooms/${room.id}/beds`)
      .set(authed(ownerToken))
      .expect(200);
    const bedId = bedsRes.body.data[0].id;
    const residentRes = await request(app.getHttpServer())
      .post('/api/v1/residents')
      .set(authed(ownerToken))
      .set('Idempotency-Key', `razorpay-order-test-${ts1}`)
      .send({
        fullName: 'Razorpay Order Test Resident',
        admissionDate: '2026-01-01',
        bedId,
        guardians: [{ fullName: 'Guardian', phone: '9999999998', relationship: 'Father' }],
      })
      .expect(201);
    const residentId = residentRes.body.data.id;

    const deniedRes = await request(app.getHttpServer())
      .post(`/api/v1/residents/${residentId}/payments/razorpay-order`)
      .set(authed(staffToken))
      .send({ amountPaisa: '50000' });
    expect(deniedRes.status).toBe(403);

    // Owner grants payments:record — no new login, same staff JWT.
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/me/staff/${staffId}/permissions`)
      .set(authed(ownerToken))
      .send({
        permissions: [
          'residents:manage',
          'payments:record',
          'reports:view',
          'files:manage',
          'notifications:send',
        ],
      })
      .expect(200);

    // With payments:record granted, route should now pass the capability check.
    // Razorpay itself is not configured in the test environment, so we expect
    // either 201 (configured) or 400 (Razorpay not configured) — either means
    // the capability guard passed. A 403 would mean the guard still blocks.
    const allowedRes = await request(app.getHttpServer())
      .post(`/api/v1/residents/${residentId}/payments/razorpay-order`)
      .set(authed(staffToken))
      .send({ amountPaisa: '50000' });
    expect(allowedRes.status).not.toBe(403);
  });

  it('owner always passes payments:record check on razorpay-order route regardless of permissions column', async () => {
    // Create a dedicated room+bed so we're not blocked by occupancy from prior tests.
    const ts2 = Date.now();
    await request(app.getHttpServer())
      .post('/api/v1/properties/me/rooms')
      .set(authed(ownerToken))
      .send({ rooms: [{ roomNumber: `RZ2-${ts2}`, floor: 5 }] });
    const listRoomsRes = await request(app.getHttpServer())
      .get('/api/v1/properties/me/rooms')
      .set(authed(ownerToken))
      .expect(200);
    const room = listRoomsRes.body.data.items.find(
      (r: { roomNumber: string }) => r.roomNumber === `RZ2-${ts2}`,
    );
    await request(app.getHttpServer())
      .post(`/api/v1/properties/me/rooms/${room.id}/beds`)
      .set(authed(ownerToken))
      .send({ beds: [{ bedLabel: 'A' }] });
    const bedsRes = await request(app.getHttpServer())
      .get(`/api/v1/properties/me/rooms/${room.id}/beds`)
      .set(authed(ownerToken))
      .expect(200);
    const bedId = bedsRes.body.data[0].id;
    const residentRes = await request(app.getHttpServer())
      .post('/api/v1/residents')
      .set(authed(ownerToken))
      .set('Idempotency-Key', `razorpay-owner-test-${ts2}`)
      .send({
        fullName: 'Razorpay Owner Test Resident',
        admissionDate: '2026-01-01',
        bedId,
        guardians: [{ fullName: 'Guardian', phone: '9999999997', relationship: 'Father' }],
      })
      .expect(201);
    const residentId = residentRes.body.data.id;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/residents/${residentId}/payments/razorpay-order`)
      .set(authed(ownerToken))
      .send({ amountPaisa: '50000' });
    expect(res.status).not.toBe(403);
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
