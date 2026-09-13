import { PrismaClient } from '@prisma/client';

/**
 * Regression test for the partial unique index
 * resident(bed_id) WHERE status = 'active' (migration
 * 20260913221921_partial_unique_active_bed). This must hold at the database
 * level, independent of any application-layer check, since a bulk import or
 * a future code path could otherwise double-book a bed.
 */
describe('Bed occupancy DB constraint', () => {
  const prisma = new PrismaClient();
  let orgId: string;
  let propertyId: string;
  let roomId: string;
  let bedId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: 'Constraint Test Org' },
    });
    orgId = org.id;

    const property = await prisma.property.create({
      data: { organizationId: orgId, name: 'Constraint Test Property' },
    });
    propertyId = property.id;

    const room = await prisma.room.create({
      data: { propertyId, roomNumber: '1', floor: 1 },
    });
    roomId = room.id;

    const bed = await prisma.bed.create({
      data: { roomId, bedLabel: 'A', status: 'occupied' },
    });
    bedId = bed.id;
  });

  afterEach(async () => {
    await prisma.resident.deleteMany({ where: { organizationId: orgId } });
  });

  afterAll(async () => {
    await prisma.resident.deleteMany({ where: { organizationId: orgId } });
    await prisma.bed.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { propertyId } });
    await prisma.property.delete({ where: { id: propertyId } });
    await prisma.organization.delete({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('rejects a second active resident on a bed that already has one', async () => {
    await prisma.resident.create({
      data: {
        organizationId: orgId,
        bedId,
        fullName: 'First Resident',
        status: 'active',
        admissionDate: new Date('2026-01-01'),
      },
    });

    await expect(
      prisma.resident.create({
        data: {
          organizationId: orgId,
          bedId,
          fullName: 'Second Resident',
          status: 'active',
          admissionDate: new Date('2026-01-02'),
        },
      }),
    ).rejects.toThrow(/Unique constraint failed/);
  });

  it('allows a vacated resident to keep a bed_id without blocking a new active admission', async () => {
    const vacated = await prisma.resident.create({
      data: {
        organizationId: orgId,
        bedId,
        fullName: 'Vacated Resident',
        status: 'vacated',
        admissionDate: new Date('2025-01-01'),
        vacateDate: new Date('2025-06-01'),
      },
    });
    expect(vacated.bedId).toBe(bedId);

    // A new active resident on the same bed must succeed since the partial
    // index only constrains rows where status = 'active'.
    const active = await prisma.resident.create({
      data: {
        organizationId: orgId,
        bedId,
        fullName: 'New Active Resident',
        status: 'active',
        admissionDate: new Date('2026-01-01'),
      },
    });
    expect(active.bedId).toBe(bedId);

    // But a second concurrent active resident on that same bed must still
    // be rejected.
    await expect(
      prisma.resident.create({
        data: {
          organizationId: orgId,
          bedId,
          fullName: 'Conflicting Resident',
          status: 'active',
          admissionDate: new Date('2026-01-03'),
        },
      }),
    ).rejects.toThrow(/Unique constraint failed/);
  });
});
