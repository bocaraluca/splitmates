import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set.");

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const USER_COUNT = 500;
const GROUP_COUNT = 200;
const EXPENSES_PER_GROUP = 200;
const PAYMENTS_PER_GROUP = 50;

const CATEGORIES = ["household", "trip", "friends", "family", "roommates", "other"] as const;
const EXPENSE_CATEGORIES = ["rent", "groceries", "utilities", "transport", "entertainment", "food", "other"] as const;
const SPLIT_TYPES = ["equal", "custom"] as const;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function buildEqualShares(total: number, userIds: number[]) {
  const base = Math.floor((total / userIds.length) * 100) / 100;
  const shares = userIds.map((userId) => ({ userId, amount: base }));
  const remainder = round2(total - round2(base * userIds.length));
  shares[shares.length - 1].amount = round2(shares[shares.length - 1].amount + remainder);
  return shares;
}

function buildCustomShares(total: number, userIds: number[]) {
  const weights = userIds.map(() => faker.number.float({ min: 1, max: 5 }));
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const shares = userIds.map((userId, i) => ({
    userId,
    amount: round2((weights[i] / weightSum) * total),
  }));
  const remainder = round2(total - round2(shares.reduce((s, sh) => s + sh.amount, 0)));
  shares[shares.length - 1].amount = round2(shares[shares.length - 1].amount + remainder);
  return shares;
}

async function main() {
  console.log("Starting faker seed...");

  const userRole = await prisma.role.findFirst({ where: { title: "user" } });
  if (!userRole) throw new Error("Run the main seed first (npx tsx prisma/seed.ts) to create roles.");

  const passwordHash = bcrypt.hashSync("password123", 10);

  console.log(`Creating ${USER_COUNT} users...`);
  const userIds: number[] = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const suffix = faker.string.alphanumeric(6);
    const username = `user_${suffix}`;
    const email = `user_${suffix}@faker.com`;
    const user = await prisma.user.create({
      data: { username, email, passwordHash, roleId: userRole.id },
    });
    userIds.push(user.id);
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${USER_COUNT} users created`);
  }

  console.log(`Creating ${GROUP_COUNT} groups...`);
  for (let g = 0; g < GROUP_COUNT; g++) {
    const memberCount = faker.number.int({ min: 3, max: 8 });
    const memberIds = faker.helpers.arrayElements(userIds, memberCount);
    const creatorId = memberIds[0];

    const group = await prisma.group.create({
      data: {
        name: faker.company.name(),
        description: faker.lorem.sentence(),
        category: faker.helpers.arrayElement(CATEGORIES),
        createdByUserId: creatorId,
        members: {
          create: memberIds.map((userId, idx) => ({ userId, isAdmin: idx === 0 })),
        },
      },
    });

    for (let e = 0; e < EXPENSES_PER_GROUP; e++) {
      const amount = round2(faker.number.float({ min: 10, max: 500 }));
      const paidByUserId = faker.helpers.arrayElement(memberIds);
      const splitType = faker.helpers.arrayElement(SPLIT_TYPES);
      const participantIds = faker.helpers.arrayElements(memberIds, faker.number.int({ min: 2, max: memberIds.length }));
      const shares = splitType === "custom"
        ? buildCustomShares(amount, participantIds)
        : buildEqualShares(amount, participantIds);

      await prisma.expense.create({
        data: {
          groupId: group.id,
          paidByUserId,
          title: faker.commerce.productName(),
          amount,
          category: faker.helpers.arrayElement(EXPENSE_CATEGORIES) as never,
          date: faker.date.recent({ days: 365 }),
          splitType: splitType as never,
          participants: { create: shares.map((s) => ({ userId: s.userId, amount: s.amount })) },
        },
      });
    }

    for (let p = 0; p < PAYMENTS_PER_GROUP; p++) {
      const [fromUserId, toUserId] = faker.helpers.arrayElements(memberIds, 2);
      await prisma.payment.create({
        data: {
          groupId: group.id,
          fromUserId,
          toUserId,
          amount: round2(faker.number.float({ min: 5, max: 200 })),
        },
      });
    }

    console.log(`  Group ${g + 1}/${GROUP_COUNT} done`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
