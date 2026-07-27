import type { PrismaClient } from "@prisma/client";
import {
  SEED_CHATTERS,
  SEED_CREATORS,
  SEED_SCHEDULE,
  SEED_WEEK_START,
  parseCell,
} from "./seedData";
import type { ShiftKey } from "./time";

/**
 * Idempotent seed: upserts the roster and models, then fills the imported week
 * only where the slot is still empty. Safe to run repeatedly.
 */
export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  const chatterIdByName = new Map<string, string>();

  for (const c of SEED_CHATTERS) {
    const row = await prisma.chatter.upsert({
      where: { name: c.name },
      update: {},
      create: {
        name: c.name,
        fullName: c.fullName,
        posterName: c.lx ? c.name : c.fullName.trim().split(/\s+/)[0] || c.name,
        color: c.color,
        aliases: (c.aliases ?? []).join(","),
        isLX: c.lx ?? false,
      },
    });
    chatterIdByName.set(row.name.toLowerCase(), row.id);
    for (const alias of c.aliases ?? []) {
      chatterIdByName.set(alias.toLowerCase(), row.id);
    }
  }

  const creatorIdByName = new Map<string, string>();
  for (let i = 0; i < SEED_CREATORS.length; i++) {
    const name = SEED_CREATORS[i];
    const row = await prisma.creator.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: i },
    });
    creatorIdByName.set(name, row.id);
  }

  const shifts: ShiftKey[] = ["MORNING", "AFTERNOON", "NIGHT"];
  for (const [creatorName, byShift] of Object.entries(SEED_SCHEDULE)) {
    const creatorId = creatorIdByName.get(creatorName);
    if (!creatorId) continue;
    for (const shift of shifts) {
      const cells = byShift[shift];
      for (let day = 0; day < 7; day++) {
        for (const rawName of parseCell(cells[day] ?? "")) {
          const chatterId = chatterIdByName.get(rawName.toLowerCase());
          if (!chatterId) {
            console.warn(`seed: unknown chatter "${rawName}" (${creatorName}, day ${day})`);
            continue;
          }
          await prisma.assignment.upsert({
            where: {
              weekStart_day_shift_creatorId_chatterId: {
                weekStart: SEED_WEEK_START,
                day,
                shift,
                creatorId,
                chatterId,
              },
            },
            update: {},
            create: { weekStart: SEED_WEEK_START, day, shift, creatorId, chatterId },
          });
        }
      }
    }
  }
}

/** Seed only when the database is brand new (first boot on Railway). */
export async function autoSeedIfEmpty(prisma: PrismaClient): Promise<boolean> {
  const count = await prisma.chatter.count();
  if (count > 0) return false;
  console.log("aura-scheduler: empty database — seeding roster + imported week");
  await seedDatabase(prisma);
  return true;
}

/**
 * Run on every boot (idempotent): ensure the intended chatters exist, and remove
 * the early placeholder scaffolding ("Chatter A".."Chatter D", "Creator One"/
 * "Creator Two") that shipped before the real roster. Only ever touches those
 * exact placeholder names, so real data added in the app stays untouched.
 */
export async function reconcileRoster(prisma: PrismaClient): Promise<void> {
  for (const c of SEED_CHATTERS) {
    await prisma.chatter.upsert({
      where: { name: c.name },
      update: {},
      create: {
        name: c.name,
        fullName: c.fullName,
        posterName: c.lx ? c.name : c.fullName.trim().split(/\s+/)[0] || c.name,
        color: c.color,
        aliases: (c.aliases ?? []).join(","),
        isLX: c.lx ?? false,
      },
    });
  }

  const placeholderChatters = ["Chatter A", "Chatter B", "Chatter C", "Chatter D"];
  const placeholderCreators = ["Creator One", "Creator Two"];
  const [phC, phCr] = await Promise.all([
    prisma.chatter.findMany({ where: { name: { in: placeholderChatters } }, select: { id: true } }),
    prisma.creator.findMany({ where: { name: { in: placeholderCreators } }, select: { id: true } }),
  ]);
  const chatterIds = phC.map((x) => x.id);
  const creatorIds = phCr.map((x) => x.id);
  if (chatterIds.length === 0 && creatorIds.length === 0) return;

  const orClauses: object[] = [];
  if (chatterIds.length) orClauses.push({ chatterId: { in: chatterIds } });
  if (creatorIds.length) orClauses.push({ creatorId: { in: creatorIds } });
  await prisma.assignment.deleteMany({ where: { OR: orClauses } });
  if (chatterIds.length) await prisma.chatter.deleteMany({ where: { id: { in: chatterIds } } });
  if (creatorIds.length) await prisma.creator.deleteMany({ where: { id: { in: creatorIds } } });
  console.log("aura-scheduler: reconciled roster (ensured chatters, removed placeholders)");
}
