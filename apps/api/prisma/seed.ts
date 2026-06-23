import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@registerkaro.local' },
    update: {},
    create: {
      email: 'admin@registerkaro.local',
      passwordHash,
      name: 'Admin Operator',
      role: 'admin',
    },
  });
  console.log('Seeded admin user: admin@registerkaro.local / admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
