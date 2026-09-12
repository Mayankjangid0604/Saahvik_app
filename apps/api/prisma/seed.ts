import { PrismaClient, SubscriptionPlan, UserRole, BedStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Demo@1234', 10);

  const org = await prisma.organization.create({
    data: {
      name: 'Demo Coaching Hostel',
      subscriptionPlan: SubscriptionPlan.beginner,
    },
  });

  const owner = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'owner@demo.com',
      passwordHash,
      name: 'Demo Owner',
      role: UserRole.owner,
      emailVerified: true,
    },
  });

  const staff = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'staff@demo.com',
      passwordHash,
      name: 'Demo Staff',
      role: UserRole.staff,
      emailVerified: true,
    },
  });

  const property = await prisma.property.create({
    data: {
      organizationId: org.id,
      name: 'Main Hostel',
      address: '123 Education Street',
      city: 'Kota',
      state: 'Rajasthan',
      timezone: 'Asia/Kolkata',
    },
  });

  const wingA = await prisma.wing.create({
    data: {
      propertyId: property.id,
      name: 'Wing A',
    },
  });

  const wingB = await prisma.wing.create({
    data: {
      propertyId: property.id,
      name: 'Wing B',
    },
  });

  const rooms = [];
  for (let floor = 1; floor <= 3; floor++) {
    for (let roomNum = 1; roomNum <= 4; roomNum++) {
      const wing = roomNum <= 2 ? wingA : wingB;
      const room = await prisma.room.create({
        data: {
          propertyId: property.id,
          wingId: wing.id,
          roomNumber: `${floor}0${roomNum}`,
          floor,
        },
      });
      rooms.push(room);
    }
  }

  const beds = [];
  for (const room of rooms) {
    for (const label of ['A', 'B', 'C']) {
      const bed = await prisma.bed.create({
        data: {
          roomId: room.id,
          bedLabel: label,
          status: BedStatus.vacant,
        },
      });
      beds.push(bed);
    }
  }

  const guardian = await prisma.guardian.create({
    data: {
      organizationId: org.id,
      fullName: 'Ramesh Kumar',
      phone: '+919876543210',
      email: 'ramesh@example.com',
    },
  });

  const resident1 = await prisma.resident.create({
    data: {
      organizationId: org.id,
      bedId: beds[0].id,
      fullName: 'Amit Kumar',
      phone: '+919876543211',
      email: 'amit@example.com',
      status: 'active',
      admissionDate: new Date('2026-01-15'),
    },
  });

  await prisma.bed.update({
    where: { id: beds[0].id },
    data: { status: BedStatus.occupied },
  });

  await prisma.guardianLink.create({
    data: {
      residentId: resident1.id,
      guardianId: guardian.id,
      relationship: 'Father',
    },
  });

  await prisma.feeStructure.create({
    data: {
      residentId: resident1.id,
      monthlyRentPaisa: BigInt(850000),
      effectiveFrom: new Date('2026-01-15'),
    },
  });

  const resident2 = await prisma.resident.create({
    data: {
      organizationId: org.id,
      bedId: beds[1].id,
      fullName: 'Priya Sharma',
      phone: '+919876543212',
      status: 'active',
      admissionDate: new Date('2026-02-01'),
    },
  });

  await prisma.bed.update({
    where: { id: beds[1].id },
    data: { status: BedStatus.occupied },
  });

  await prisma.guardianLink.create({
    data: {
      residentId: resident2.id,
      guardianId: guardian.id,
      relationship: 'Father',
    },
  });

  await prisma.feeStructure.create({
    data: {
      residentId: resident2.id,
      monthlyRentPaisa: BigInt(750000),
      effectiveFrom: new Date('2026-02-01'),
    },
  });

  await prisma.payment.create({
    data: {
      residentId: resident1.id,
      amountPaisa: BigInt(850000),
      method: 'upi',
      paidOn: new Date('2026-02-01'),
      idempotencyKey: 'seed-payment-1',
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: owner.id,
      action: 'SEED_DATA_CREATED',
      entityType: 'organization',
      entityId: org.id,
      metadata: { note: 'Demo seed data' },
    },
  });

  console.log('Seed complete!');
  console.log(`  Organization: ${org.name} (${org.id})`);
  console.log(`  Owner login: owner@demo.com / Demo@1234`);
  console.log(`  Staff login: staff@demo.com / Demo@1234`);
  console.log(`  Property: ${property.name}`);
  console.log(`  Wings: ${wingA.name}, ${wingB.name}`);
  console.log(`  Rooms: ${rooms.length}`);
  console.log(`  Beds: ${beds.length}`);
  console.log(`  Residents: 2`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
