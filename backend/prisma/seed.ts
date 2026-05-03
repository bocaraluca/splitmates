import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const PASSWORD = "raluca";

const APARTMENT_TEMPLATES = [
  { title: "Rent", category: "rent", min: 1500, max: 1900 },
  { title: "Groceries", category: "groceries", min: 100, max: 500 },
  { title: "Internet bill", category: "utilities", min: 80, max: 120 },
  { title: "Electricity", category: "utilities", min: 150, max: 280 },
  { title: "Water bill", category: "utilities", min: 60, max: 120 },
  { title: "Cleaning supplies", category: "other", min: 30, max: 80 },
  { title: "Dinner takeout", category: "food", min: 60, max: 180 },
  { title: "Movie night", category: "entertainment", min: 30, max: 70 },
  { title: "Bus tickets", category: "transport", min: 20, max: 50 },
  { title: "Coffee run", category: "food", min: 25, max: 60 },
  { title: "Toiletries", category: "other", min: 40, max: 100 },
  { title: "Streaming subscription", category: "entertainment", min: 25, max: 60 },
] as const;

const TRIP_TEMPLATES = [
  { title: "Train tickets", category: "transport", min: 100, max: 200 },
  { title: "Hotel night", category: "other", min: 200, max: 400 },
  { title: "Restaurant dinner", category: "food", min: 80, max: 250 },
  { title: "Museum tickets", category: "entertainment", min: 50, max: 120 },
  { title: "Snacks at gas station", category: "groceries", min: 20, max: 60 },
  { title: "Taxi ride", category: "transport", min: 30, max: 80 },
  { title: "Breakfast cafe", category: "food", min: 40, max: 110 },
  { title: "Souvenirs", category: "other", min: 30, max: 150 },
  { title: "City pass", category: "entertainment", min: 60, max: 130 },
  { title: "Bike rental", category: "transport", min: 40, max: 90 },
] as const;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function buildEqualShares(total: number, userIds: number[]) {
  const base = Math.floor((total / userIds.length) * 100) / 100;
  const shares = userIds.map((userId) => ({ userId, amount: base }));
  const distributedSum = round2(base * userIds.length);
  const remainder = round2(total - distributedSum);
  shares[shares.length - 1].amount = round2(shares[shares.length - 1].amount + remainder);
  return shares;
}

function buildCustomShares(total: number, userIds: number[]) {
  const weights = userIds.map(() => faker.number.float({ min: 1, max: 5 }));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const shares = userIds.map((userId, i) => ({
    userId,
    amount: round2((weights[i] / weightSum) * total),
  }));
  const distributedSum = round2(shares.reduce((sum, s) => sum + s.amount, 0));
  const remainder = round2(total - distributedSum);
  shares[shares.length - 1].amount = round2(shares[shares.length - 1].amount + remainder);
  return shares;
}

function pickRandomSubset<T>(items: T[], minSize = 2): T[] {
  const size = faker.number.int({ min: minSize, max: items.length });
  return faker.helpers.arrayElements(items, size);
}

async function deleteAllData() {
  await prisma.session.deleteMany({});
  await prisma.expenseParticipant.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.role.deleteMany({});
}

async function seedRolesAndPermissions() {
  const adminRole = await prisma.role.create({ data: { title: "admin" } });
  const userRole = await prisma.role.create({ data: { title: "user" } });

  const permissionTitles = [
    "View all users",
    "Delete user",
    "Update user role",
    "Create group",
    "Edit any group",
    "Delete any group",
    "View all groups",
    "Create expense",
    "Delete own expense",
    "Delete any expense",
    "Edit own expense",
    "Edit any expense",
    "Create payment",
    "Delete any payment",
    "Send chat messages",
  ];

  const permissions = await Promise.all(
    permissionTitles.map((title) => prisma.permission.create({ data: { title } })),
  );

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: adminRole.id, permissionId: permission.id })),
  });

  const userPermissionTitles = new Set([
    "Create group",
    "Create expense",
    "Delete own expense",
    "Edit own expense",
    "Create payment",
    "Send chat messages",
  ]);

  const userPermissions = permissions.filter((p) => userPermissionTitles.has(p.title));
  await prisma.rolePermission.createMany({
    data: userPermissions.map((permission) => ({ roleId: userRole.id, permissionId: permission.id })),
  });

  return { adminRole, userRole };
}

async function seedExpensesForGroup(
  groupId: number,
  memberIds: number[],
  templates: ReadonlyArray<{ title: string; category: string; min: number; max: number }>,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const template = faker.helpers.arrayElement(templates);
    const amount = round2(faker.number.float({ min: template.min, max: template.max }));
    const date = faker.date.recent({ days: 180 });
    const paidByUserId = faker.helpers.arrayElement(memberIds);
    const isCustom = faker.number.float() < 0.2;
    const splitType = isCustom ? "custom" : "equal";

    const participantIds =
      memberIds.length > 2 && faker.number.float() < 0.3
        ? pickRandomSubset(memberIds, 2)
        : [...memberIds];

    const shares = isCustom
      ? buildCustomShares(amount, participantIds)
      : buildEqualShares(amount, participantIds);

    await prisma.expense.create({
      data: {
        groupId,
        paidByUserId,
        title: template.title,
        amount,
        category: template.category as never, 
        date,
        splitType: splitType as never, 
        participants: {
          create: shares.map((share) => ({
            userId: share.userId,
            amount: share.amount,
          })),
        },
      },
    });
  }
}

async function main() {
  await deleteAllData();

  const { adminRole, userRole } = await seedRolesAndPermissions();
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  const raluca = await prisma.user.create({
    data: { username: "raluca", email: "raluca@gmail.com", passwordHash, roleId: adminRole.id },
  });
  const ana = await prisma.user.create({
    data: { username: "ana", email: "ana@gmail.com", passwordHash, roleId: userRole.id },
  });
  const elena = await prisma.user.create({
    data: { username: "elena", email: "elena@gmail.com", passwordHash, roleId: userRole.id },
  });
  const rares = await prisma.user.create({
    data: { username: "rares", email: "rares@gmail.com", passwordHash, roleId: userRole.id },
  });

  const apartment = await prisma.group.create({
    data: {
      name: "Apartment",
      description: "Shared apartment expenses",
      category: "household",
      createdByUserId: raluca.id,
      members: {
        create: [
          { userId: raluca.id, isAdmin: true },
          { userId: ana.id, isAdmin: false },
          { userId: elena.id, isAdmin: false },
          { userId: rares.id, isAdmin: false },
        ],
      },
    },
  });

  const weekendTrip = await prisma.group.create({
    data: {
      name: "Weekend Trip",
      description: "Weekend getaway with friends",
      category: "trip",
      createdByUserId: ana.id,
      members: {
        create: [
          { userId: raluca.id, isAdmin: false },
          { userId: ana.id, isAdmin: true },
          { userId: rares.id, isAdmin: false },
        ],
      },
    },
  });

  const apartmentMemberIds = [raluca.id, ana.id, elena.id, rares.id];
  const tripMemberIds = [raluca.id, ana.id, rares.id];

  const apartmentExpenseCount = faker.number.int({ min: 12, max: 18 });
  const tripExpenseCount = faker.number.int({ min: 12, max: 18 });

  await seedExpensesForGroup(apartment.id, apartmentMemberIds, APARTMENT_TEMPLATES, apartmentExpenseCount);

  await seedExpensesForGroup(weekendTrip.id, tripMemberIds, TRIP_TEMPLATES, tripExpenseCount);

  await prisma.payment.createMany({
    data: [
      { groupId: apartment.id, fromUserId: elena.id, toUserId: raluca.id, amount: 50 },
      { groupId: apartment.id, fromUserId: ana.id, toUserId: raluca.id, amount: 80 },
      { groupId: apartment.id, fromUserId: rares.id, toUserId: raluca.id, amount: 120 },
      { groupId: weekendTrip.id, fromUserId: rares.id, toUserId: ana.id, amount: 60 },
      { groupId: weekendTrip.id, fromUserId: raluca.id, toUserId: ana.id, amount: 40 },
    ],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });