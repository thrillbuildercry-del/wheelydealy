import { PrismaClient, Role, ProductType, CommissionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      cuffEnabled: true,
      personalUseMultiplier: 0.1,
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 5
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@wheelydealy.local' },
    update: {},
    create: {
      email: 'admin@wheelydealy.local',
      name: 'Demo Admin',
      googleSub: 'demo-admin-sub',
      role: Role.ADMIN
    }
  });

  await prisma.user.upsert({
    where: { email: 'worker@wheelydealy.local' },
    update: {},
    create: {
      email: 'worker@wheelydealy.local',
      name: 'Demo Worker',
      googleSub: 'demo-worker-sub',
      role: Role.WORKER
    }
  });

  await prisma.product.createMany({
    data: [
      { name: 'Hard Item A', type: ProductType.HARD, totalQuantity: 100, costPrice: 8, sellPrice: 12 },
      { name: 'Soft Item B', type: ProductType.SOFT, totalQuantity: 250, costPrice: 2.5, sellPrice: 4.5 }
    ],
    skipDuplicates: true
  });

  console.log('Seeded successfully. Admin user id:', admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
