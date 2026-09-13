import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/http-exception.filter';

/**
 * Tenant isolation is the single highest-priority test in the suite
 * (09_Test_Plan_QA_Strategy.md, 11_Acceptance_Criteria_Signoff_Checklist.md):
 * Organization A must never be able to read or write Organization B's data,
 * through any org-scoped endpoint, full stop.
 *
 * Both organizations are created through the real signup/auth/property/
 * resident/billing/notification APIs — never seeded directly into the DB —
 * so this test also exercises the real tenant-scoping logic in every
 * service, not a hand-picked subset.
 */
describe('Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  interface OrgContext {
    token: string;
    userId: string;
    orgId: string;
    residentId: string;
    bedId: string;
    paymentId: string;
    templateId: string;
    fileKey: string;
  }

  let orgA: OrgContext;
  let orgB: OrgContext;

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

  async function buildOrg(
    label: string,
    email: string,
  ): Promise<OrgContext> {
    const password = 'Passw0rd!123';

    const signupRes = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ email, password, name: `${label} Owner`, orgName: `${label} Hostel` })
      .expect(201);

    const { userId, organizationId: orgId } = signupRes.body.data;

    const token = await verifyEmailAndLogin(email, password);

    // Rooms + beds
    await request(app.getHttpServer())
      .post('/api/v1/properties/me/rooms')
      .set(authed(token))
      .send({ rooms: [{ roomNumber: '101', floor: 1 }] })
      .expect(201);

    const roomsRes = await request(app.getHttpServer())
      .get('/api/v1/properties/me/rooms')
      .set(authed(token))
      .expect(200);
    const roomId = roomsRes.body.data.items[0].id;

    await request(app.getHttpServer())
      .post(`/api/v1/properties/me/rooms/${roomId}/beds`)
      .set(authed(token))
      .send({ beds: [{ bedLabel: 'A' }] })
      .expect(201);

    const bedsRes = await request(app.getHttpServer())
      .get(`/api/v1/properties/me/rooms/${roomId}/beds`)
      .set(authed(token))
      .expect(200);
    const bedId = bedsRes.body.data[0].id;

    // Resident
    const residentRes = await request(app.getHttpServer())
      .post('/api/v1/residents')
      .set(authed(token))
      .set('Idempotency-Key', `${label}-admit-${Date.now()}`)
      .send({
        fullName: `${label} Resident`,
        admissionDate: '2026-01-01',
        bedId,
        guardians: [
          { fullName: `${label} Guardian`, phone: '9999999999', relationship: 'Father' },
        ],
      })
      .expect(201);
    const residentId = residentRes.body.data.id;

    // Fee structure + payment (so billing endpoints have real cross-org data)
    await request(app.getHttpServer())
      .post(`/api/v1/residents/${residentId}/fee-structure`)
      .set(authed(token))
      .send({ monthlyRentPaisa: '500000', effectiveFrom: '2026-01-01' })
      .expect(201);

    const paymentRes = await request(app.getHttpServer())
      .post(`/api/v1/residents/${residentId}/payments`)
      .set(authed(token))
      .set('Idempotency-Key', `${label}-payment-${Date.now()}`)
      .send({ amountPaisa: '500000', method: 'cash', paidOn: '2026-01-05' })
      .expect(201);
    const paymentId = paymentRes.body.data.id;

    // Notification template
    const templateRes = await request(app.getHttpServer())
      .post('/api/v1/notifications/templates')
      .set(authed(token))
      .send({ name: `${label} Template`, channel: 'email', body: 'Hello {{name}}' })
      .expect(201);
    const templateId = templateRes.body.data.id;

    // File upload (resident ID doc)
    const uploadRes = await request(app.getHttpServer())
      .post('/api/v1/files/upload')
      .set(authed(token))
      .attach('file', Buffer.from('fake-id-document'), 'id.pdf')
      .expect(201);
    const fileKey = uploadRes.body.data.key;

    return { token, userId, orgId, residentId, bedId, paymentId, templateId, fileKey };
  }

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

    orgA = await buildOrg('OrgA', `orga-${Date.now()}@example.com`);
    orgB = await buildOrg('OrgB', `orgb-${Date.now()}@example.com`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Residents', () => {
    it('Org A cannot GET an Org B resident by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/residents/${orgB.residentId}`)
        .set(authed(orgA.token));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESIDENT_NOT_FOUND');
    });

    it('Org A cannot PATCH an Org B resident', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/residents/${orgB.residentId}`)
        .set(authed(orgA.token))
        .send({ fullName: 'Hijacked' });
      expect(res.status).toBe(404);
    });

    it('Org A cannot assign-bed on an Org B resident', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/residents/${orgB.residentId}/assign-bed`)
        .set(authed(orgA.token))
        .set('Idempotency-Key', `hack-assign-${Date.now()}`)
        .send({ bedId: orgA.bedId });
      expect(res.status).toBe(404);
    });

    it('Org A cannot vacate an Org B resident', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/residents/${orgB.residentId}/vacate`)
        .set(authed(orgA.token))
        .set('Idempotency-Key', `hack-vacate-${Date.now()}`)
        .send({ vacateDate: '2026-02-01' });
      expect(res.status).toBe(404);
    });

    it('Org A cannot transfer an Org B resident', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/residents/${orgB.residentId}/transfer`)
        .set(authed(orgA.token))
        .set('Idempotency-Key', `hack-transfer-${Date.now()}`)
        .send({ newBedId: orgA.bedId });
      expect(res.status).toBe(404);
    });

    it('Org A resident list never includes an Org B resident', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/residents')
        .query({ pageSize: 100 })
        .set(authed(orgA.token))
        .expect(200);
      const ids = res.body.data.items.map((r: { id: string }) => r.id);
      expect(ids).toContain(orgA.residentId);
      expect(ids).not.toContain(orgB.residentId);
    });

    it('Org A search never surfaces an Org B resident', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/residents/search')
        .query({ q: 'Resident' })
        .set(authed(orgA.token))
        .expect(200);
      const ids = (res.body.data.items ?? res.body.data).map((r: { id: string }) => r.id);
      expect(ids).not.toContain(orgB.residentId);
    });
  });

  describe('Billing', () => {
    it('Org A cannot set fee structure on an Org B resident', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/residents/${orgB.residentId}/fee-structure`)
        .set(authed(orgA.token))
        .send({ monthlyRentPaisa: '100000', effectiveFrom: '2026-01-01' });
      expect(res.status).toBe(404);
    });

    it('Org A cannot read an Org B resident fee structure', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/residents/${orgB.residentId}/fee-structure`)
        .set(authed(orgA.token));
      expect(res.status).toBe(404);
    });

    it('Org A cannot record a payment against an Org B resident', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/residents/${orgB.residentId}/payments`)
        .set(authed(orgA.token))
        .set('Idempotency-Key', `hack-payment-${Date.now()}`)
        .send({ amountPaisa: '100000', method: 'cash', paidOn: '2026-01-05' });
      expect(res.status).toBe(404);
    });

    it("Org A cannot list an Org B resident's payments", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/residents/${orgB.residentId}/payments`)
        .set(authed(orgA.token));
      expect(res.status).toBe(404);
    });

    it("Org A cannot fetch an Org B payment's receipt", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/residents/${orgB.residentId}/payments/${orgB.paymentId}/receipt`)
        .set(authed(orgA.token));
      expect(res.status).toBe(404);
    });

    it("Org A cannot read an Org B resident's dues", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/residents/${orgB.residentId}/dues`)
        .set(authed(orgA.token));
      expect(res.status).toBe(404);
    });

    it('Org A org-wide dues list never includes an Org B resident', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dues')
        .query({ pageSize: 100 })
        .set(authed(orgA.token))
        .expect(200);
      const residentIds = res.body.data.items.map(
        (d: { residentId: string }) => d.residentId,
      );
      expect(residentIds).not.toContain(orgB.residentId);
    });
  });

  describe('Notifications', () => {
    it("Org A cannot update Org B's notification template", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/templates/${orgB.templateId}`)
        .set(authed(orgA.token))
        .send({ name: 'Hijacked template' });
      expect(res.status).toBe(404);
    });

    it("Org A's template list never includes Org B's template", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications/templates')
        .set(authed(orgA.token))
        .expect(200);
      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).not.toContain(orgB.templateId);
    });
  });

  describe('Files', () => {
    it("Org A cannot fetch Org B's file by key", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/files/${orgB.fileKey}`)
        .set(authed(orgA.token));
      expect([403, 404]).toContain(res.status);
    });

    it("Org A cannot delete Org B's file by key", async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/files/${orgB.fileKey}`)
        .set(authed(orgA.token));
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Audit logs', () => {
    it("Org A's audit log never includes an Org B entity", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/audit-logs')
        .query({ pageSize: 200 })
        .set(authed(orgA.token))
        .expect(200);
      const entityIds = res.body.data.items.map(
        (log: { entityId: string | null }) => log.entityId,
      );
      expect(entityIds).not.toContain(orgB.residentId);
      expect(entityIds).not.toContain(orgB.paymentId);
    });
  });

  describe('Dashboard and occupancy', () => {
    it("Org A's dashboard summary only reflects Org A's own data", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set(authed(orgA.token))
        .expect(200);
      // Each org admitted exactly one resident onto exactly one bed.
      expect(res.body.data.totalResidents).toBe(1);
      expect(res.body.data.totalBeds).toBe(1);
      const admissionIds = res.body.data.recentAdmissions.map((a: { id: string }) => a.id);
      expect(admissionIds).not.toContain(orgB.residentId);
    });

    it("Org A's occupancy view only reflects Org A's own property", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/properties/me/occupancy')
        .set(authed(orgA.token))
        .expect(200);
      expect(res.body.data.totalBeds).toBe(1);
      const roomIds = res.body.data.rooms.map((r: { id: string }) => r.id);
      // Org B's room must never leak into Org A's occupancy grid.
      expect(roomIds.length).toBe(1);
    });
  });

  describe('Sanity: each org can access its own data', () => {
    it('Org A can read its own resident', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/residents/${orgA.residentId}`)
        .set(authed(orgA.token))
        .expect(200);
      expect(res.body.data.id).toBe(orgA.residentId);
    });

    it('Org B can read its own resident', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/residents/${orgB.residentId}`)
        .set(authed(orgB.token))
        .expect(200);
      expect(res.body.data.id).toBe(orgB.residentId);
    });
  });
});
