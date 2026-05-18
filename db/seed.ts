import 'dotenv/config';
import { db } from './client';
import { locations, users } from './schema';

async function seed() {
  console.log('🌱 Seeding...');

  // Admin
  const [_admin] = await db
    .insert(users)
    .values({
      email: 'admin@stockbridge.local',
      name: 'Admin',
      role: 'admin',
    })
    .returning();

  // Depósito central
  const [_warehouse] = await db
    .insert(locations)
    .values({
      code: 'WH-01',
      name: 'Depósito Central',
      type: 'warehouse',
    })
    .returning();

  // 6 motoristas + 6 caminhões
  const driverNames = ['João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Lucia'];
  for (let i = 0; i < 6; i++) {
    const [driver] = await db
      .insert(users)
      .values({
        email: `driver${i + 1}@stockbridge.local`,
        name: driverNames[i] ?? 'Driver',
        role: 'driver',
      })
      .returning();

    await db.insert(locations).values({
      code: `TRUCK-${String(i + 1).padStart(2, '0')}`,
      name: `Caminhão ${driverNames[i]}`,
      type: 'truck',
      assignedUserId: driver?.id,
    });
  }

  console.log('✅ Seed done.');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
