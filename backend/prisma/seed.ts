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
  { title: "Gas bill", category: "utilities", min: 80, max: 200 },
  { title: "Cleaning supplies", category: "other", min: 30, max: 80 },
  { title: "Dinner takeout", category: "food", min: 60, max: 180 },
  { title: "Movie night", category: "entertainment", min: 30, max: 70 },
  { title: "Bus tickets", category: "transport", min: 20, max: 50 },
  { title: "Coffee run", category: "food", min: 25, max: 60 },
  { title: "Toiletries", category: "other", min: 40, max: 100 },
  { title: "Streaming subscription", category: "entertainment", min: 25, max: 60 },
  { title: "Laundry detergent", category: "other", min: 20, max: 50 },
  { title: "Light bulbs", category: "other", min: 15, max: 40 },
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
  { title: "Airport transfer", category: "transport", min: 80, max: 150 },
  { title: "Hostel booking", category: "other", min: 100, max: 250 },
  { title: "Local tour", category: "entertainment", min: 70, max: 180 },
  { title: "Lunch", category: "food", min: 50, max: 120 },
  { title: "Petrol", category: "transport", min: 100, max: 200 },
] as const;

const FRIENDS_TEMPLATES = [
  { title: "Bar night", category: "alcohol", min: 80, max: 200 },
  { title: "Restaurant", category: "food", min: 100, max: 300 },
  { title: "Bowling", category: "entertainment", min: 60, max: 120 },
  { title: "Karaoke", category: "entertainment", min: 50, max: 130 },
  { title: "Pizza night", category: "fast_food", min: 60, max: 150 },
  { title: "Cinema", category: "entertainment", min: 40, max: 100 },
  { title: "Escape room", category: "entertainment", min: 80, max: 160 },
  { title: "Cocktails", category: "alcohol", min: 60, max: 150 },
  { title: "Uber home", category: "transport", min: 30, max: 80 },
  { title: "Concert tickets", category: "entertainment", min: 100, max: 300 },
  { title: "Cigarettes", category: "smoking", min: 20, max: 60 },
  { title: "Sports bet", category: "gambling", min: 30, max: 200 },
] as const;

const BAD_HABIT_TEMPLATES = [
  { title: "Cigarettes", category: "smoking", min: 20, max: 60 },
  { title: "Sports bet", category: "gambling", min: 30, max: 300 },
  { title: "Casino night", category: "gambling", min: 100, max: 500 },
  { title: "Beers", category: "alcohol", min: 20, max: 80 },
  { title: "Wine bottles", category: "alcohol", min: 40, max: 120 },
  { title: "McDonald's", category: "fast_food", min: 30, max: 80 },
  { title: "KFC", category: "fast_food", min: 35, max: 90 },
  { title: "Designer bag", category: "luxury", min: 300, max: 1200 },
  { title: "Luxury watch", category: "luxury", min: 500, max: 2000 },
  { title: "Amazon impulse buy", category: "online_shopping", min: 30, max: 200 },
  { title: "Temu haul", category: "online_shopping", min: 20, max: 100 },
  { title: "Unused gym subscription", category: "subscriptions", min: 50, max: 120 },
  { title: "Streaming services", category: "subscriptions", min: 20, max: 60 },
  { title: "Energy drinks", category: "fast_food", min: 15, max: 50 },
] as const;

const ROOMMATES_TEMPLATES = [
  { title: "Rent", category: "rent", min: 1200, max: 1600 },
  { title: "Groceries", category: "groceries", min: 80, max: 300 },
  { title: "Internet", category: "utilities", min: 60, max: 100 },
  { title: "Electricity", category: "utilities", min: 100, max: 220 },
  { title: "Water", category: "utilities", min: 50, max: 100 },
  { title: "Household items", category: "other", min: 30, max: 120 },
  { title: "Takeaway", category: "food", min: 50, max: 150 },
  { title: "Cleaning service", category: "other", min: 100, max: 200 },
  { title: "Paper towels & soap", category: "other", min: 15, max: 40 },
] as const;

const FAMILY_TEMPLATES = [
  { title: "Restaurant", category: "food", min: 150, max: 400 },
  { title: "Hotel", category: "other", min: 300, max: 600 },
  { title: "Fuel", category: "transport", min: 80, max: 200 },
  { title: "Theme park", category: "entertainment", min: 100, max: 250 },
  { title: "Groceries", category: "groceries", min: 100, max: 400 },
  { title: "Pharmacy", category: "other", min: 30, max: 100 },
  { title: "Lunch", category: "food", min: 80, max: 200 },
  { title: "Ice cream", category: "food", min: 20, max: 60 },
  { title: "Parking", category: "transport", min: 15, max: 50 },
  { title: "Activities", category: "entertainment", min: 80, max: 200 },
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
  await prisma.observation.deleteMany({});
  await prisma.suspiciousUser.deleteMany({});
  await prisma.detectionRule.deleteMany({});
  await prisma.log.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.paymentRequest.deleteMany({});
  await prisma.expenseParticipant.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.magicLinkToken.deleteMany({});
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
    "View all logs",
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

async function seedDetectionRules() {
  await prisma.detectionRule.createMany({
    data: [
      {
        key: "multiple_failed_logins",
        name: "5+ failed logins in 5 minutes",
        description: "Repeated failed login attempts from the same user.",
        enabled: true,
        weight: 5,
        params: { count: 5, windowMin: 5 },
      },
      {
        key: "many_delete_actions",
        name: "10+ delete actions in 1 hour",
        description: "Repeated delete actions made by the same user.",
        enabled: true,
        weight: 3,
        params: { count: 10, windowMin: 60 },
      },
      {
        key: "repeated_forbidden_actions",
        name: "5+ forbidden actions in 1 hour",
        description: "Repeated forbidden attempts made by the same user.",
        enabled: true,
        weight: 4,
        params: { count: 5, windowMin: 60 },
      },
      {
        key: "too_many_requests_blocked",
        name: "4+ blocked requests in 1 hour",
        description: "Repeated rate-limited requests.",
        enabled: true,
        weight: 2,
        params: { count: 4, windowMin: 60 },
      },
    ],
  });
}

const BAD_HABIT_CATEGORIES = new Set([
  "alcohol", "gambling", "smoking", "fast_food", "luxury", "online_shopping", "subscriptions",
]);

async function seedExpensesForGroup(
  groupId: number,
  memberIds: number[],
  templates: ReadonlyArray<{ title: string; category: string; min: number; max: number }>,
  count: number,
  isBadHabitOverride?: boolean,
) {
  for (let i = 0; i < count; i++) {
    const template = faker.helpers.arrayElement(templates);
    const amount = round2(faker.number.float({ min: template.min, max: template.max }));
    const date = faker.date.recent({ days: 180 });
    const paidByUserId = faker.helpers.arrayElement(memberIds);
    const isCustom = faker.number.float() < 0.2;
    const splitType = isCustom ? "custom" : "equal";
    const isBadHabit = isBadHabitOverride ?? BAD_HABIT_CATEGORIES.has(template.category);

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
        isBadHabit,
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
  await seedDetectionRules();
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  // --- Users ---
  await prisma.user.create({
    data: { username: "admin", email: "ralucaboca06@yahoo.com", passwordHash, roleId: adminRole.id },
  });

  const raluca = await prisma.user.create({
    data: { username: "raluca", email: "ralucaboca06@gmail.com", passwordHash, roleId: userRole.id },
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
  const mihai = await prisma.user.create({
    data: { username: "mihai", email: "mihai@gmail.com", passwordHash, roleId: userRole.id },
  });
  const ioana = await prisma.user.create({
    data: { username: "ioana", email: "ioana@gmail.com", passwordHash, roleId: userRole.id },
  });
  const andrei = await prisma.user.create({
    data: { username: "andrei", email: "andrei@gmail.com", passwordHash, roleId: userRole.id },
  });
  const maria = await prisma.user.create({
    data: { username: "maria", email: "maria@gmail.com", passwordHash, roleId: userRole.id },
  });
  const vlad = await prisma.user.create({
    data: { username: "vlad", email: "vlad@gmail.com", passwordHash, roleId: userRole.id },
  });
  const cristina = await prisma.user.create({
    data: { username: "cristina", email: "cristina@gmail.com", passwordHash, roleId: userRole.id },
  });

  // --- Groups ---
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
      name: "Weekend in Sinaia",
      description: "Weekend getaway to the mountains",
      category: "trip",
      createdByUserId: ana.id,
      members: {
        create: [
          { userId: raluca.id, isAdmin: false },
          { userId: ana.id, isAdmin: true },
          { userId: rares.id, isAdmin: false },
          { userId: mihai.id, isAdmin: false },
        ],
      },
    },
  });

  const europeTrip = await prisma.group.create({
    data: {
      name: "Europe Trip",
      description: "Interrail through Europe",
      category: "trip",
      createdByUserId: raluca.id,
      members: {
        create: [
          { userId: raluca.id, isAdmin: true },
          { userId: rares.id, isAdmin: false },
          { userId: andrei.id, isAdmin: false },
          { userId: cristina.id, isAdmin: false },
        ],
      },
    },
  });

  const roommatesCluj = await prisma.group.create({
    data: {
      name: "Cluj Roommates",
      description: "Shared flat in Cluj-Napoca",
      category: "roommates",
      createdByUserId: vlad.id,
      members: {
        create: [
          { userId: raluca.id, isAdmin: false },
          { userId: vlad.id, isAdmin: true },
          { userId: cristina.id, isAdmin: false },
        ],
      },
    },
  });

  const friendsGroup = await prisma.group.create({
    data: {
      name: "Friends",
      description: "Nights out and hangouts",
      category: "friends",
      createdByUserId: mihai.id,
      members: {
        create: [
          { userId: raluca.id, isAdmin: false },
          { userId: ana.id, isAdmin: false },
          { userId: mihai.id, isAdmin: true },
          { userId: ioana.id, isAdmin: false },
          { userId: vlad.id, isAdmin: false },
        ],
      },
    },
  });

  const familyGroup = await prisma.group.create({
    data: {
      name: "Family Vacation",
      description: "Summer family holiday",
      category: "family",
      createdByUserId: ioana.id,
      members: {
        create: [
          { userId: raluca.id, isAdmin: false },
          { userId: ioana.id, isAdmin: true },
          { userId: andrei.id, isAdmin: false },
          { userId: maria.id, isAdmin: false },
        ],
      },
    },
  });

  // --- Expenses ---
  await seedExpensesForGroup(apartment.id, [raluca.id, ana.id, elena.id, rares.id], APARTMENT_TEMPLATES, 20);
  await seedExpensesForGroup(weekendTrip.id, [raluca.id, ana.id, rares.id, mihai.id], TRIP_TEMPLATES, 18);
  await seedExpensesForGroup(europeTrip.id, [raluca.id, rares.id, andrei.id, cristina.id], TRIP_TEMPLATES, 18);
  await seedExpensesForGroup(roommatesCluj.id, [raluca.id, vlad.id, cristina.id], ROOMMATES_TEMPLATES, 15);
  await seedExpensesForGroup(friendsGroup.id, [raluca.id, ana.id, mihai.id, ioana.id, vlad.id], FRIENDS_TEMPLATES, 15);
  await seedExpensesForGroup(familyGroup.id, [raluca.id, ioana.id, andrei.id, maria.id], FAMILY_TEMPLATES, 15);

  // Bad habit expenses
  await seedExpensesForGroup(apartment.id, [raluca.id, ana.id, elena.id, rares.id], BAD_HABIT_TEMPLATES, 8);
  await seedExpensesForGroup(friendsGroup.id, [raluca.id, ana.id, mihai.id, ioana.id, vlad.id], BAD_HABIT_TEMPLATES, 8);
  await seedExpensesForGroup(roommatesCluj.id, [raluca.id, vlad.id, cristina.id], BAD_HABIT_TEMPLATES, 6);
  await seedExpensesForGroup(weekendTrip.id, [raluca.id, ana.id, rares.id, mihai.id], BAD_HABIT_TEMPLATES, 6);
  await seedExpensesForGroup(europeTrip.id, [raluca.id, rares.id, andrei.id, cristina.id], BAD_HABIT_TEMPLATES, 6);
  await seedExpensesForGroup(familyGroup.id, [raluca.id, ioana.id, andrei.id, maria.id], BAD_HABIT_TEMPLATES, 5);

  // --- Payments (all statuses x all methods x all user pairs covered) ---
  await prisma.payment.createMany({
    data: [
      // Apartment — 25 payments, all 6 status+method combos covered
      { groupId: apartment.id, fromUserId: elena.id,  toUserId: raluca.id, amount: 50,  status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: ana.id,    toUserId: raluca.id, amount: 80,  status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: rares.id,  toUserId: raluca.id, amount: 120, status: "pending",   method: "manual" },
      { groupId: apartment.id, fromUserId: elena.id,  toUserId: ana.id,    amount: 35,  status: "failed",    method: "manual" },
      { groupId: apartment.id, fromUserId: rares.id,  toUserId: elena.id,  amount: 60,  status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: ana.id,    toUserId: elena.id,  amount: 45,  status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: raluca.id, toUserId: ana.id,    amount: 30,  status: "pending",   method: "manual" },
      { groupId: apartment.id, fromUserId: elena.id,  toUserId: rares.id,  amount: 55,  status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: rares.id,  toUserId: ana.id,    amount: 70,  status: "failed",    method: "manual" },
      { groupId: apartment.id, fromUserId: ana.id,    toUserId: raluca.id, amount: 95,  status: "pending",   method: "manual" },
      { groupId: apartment.id, fromUserId: elena.id,  toUserId: raluca.id, amount: 110, status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: rares.id,  toUserId: raluca.id, amount: 85,  status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: ana.id,    toUserId: rares.id,  amount: 40,  status: "pending",   method: "manual" },
      { groupId: apartment.id, fromUserId: raluca.id, toUserId: elena.id,  amount: 25,  status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: rares.id,  toUserId: elena.id,  amount: 75,  status: "failed",    method: "manual" },
      { groupId: apartment.id, fromUserId: elena.id,  toUserId: ana.id,    amount: 90,  status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: raluca.id, toUserId: rares.id,  amount: 15,  status: "pending",   method: "manual" },
      { groupId: apartment.id, fromUserId: ana.id,    toUserId: elena.id,  amount: 200, status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: rares.id,  toUserId: ana.id,    amount: 130, status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: elena.id,  toUserId: raluca.id, amount: 45,  status: "failed",    method: "manual" },
      { groupId: apartment.id, fromUserId: ana.id,    toUserId: raluca.id, amount: 60,  status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: raluca.id, toUserId: ana.id,    amount: 55,  status: "pending",   method: "manual" },
      { groupId: apartment.id, fromUserId: rares.id,  toUserId: raluca.id, amount: 180, status: "completed", method: "manual" },
      { groupId: apartment.id, fromUserId: elena.id,  toUserId: rares.id,  amount: 30,  status: "pending",   method: "manual" },
      { groupId: apartment.id, fromUserId: ana.id,    toUserId: rares.id,  amount: 65,  status: "failed",    method: "manual" },

      // Weekend in Sinaia — 20 payments
      { groupId: weekendTrip.id, fromUserId: rares.id,  toUserId: ana.id,    amount: 60,  status: "completed", method: "manual" },
      { groupId: weekendTrip.id, fromUserId: raluca.id, toUserId: ana.id,    amount: 40,  status: "pending",   method: "manual" },
      { groupId: weekendTrip.id, fromUserId: mihai.id,  toUserId: raluca.id, amount: 75,  status: "completed", method: "manual" },
      { groupId: weekendTrip.id, fromUserId: ana.id,    toUserId: raluca.id, amount: 55,  status: "completed", method: "manual" },
      { groupId: weekendTrip.id, fromUserId: rares.id,  toUserId: mihai.id,  amount: 90,  status: "failed",    method: "manual" },
      { groupId: weekendTrip.id, fromUserId: mihai.id,  toUserId: ana.id,    amount: 45,  status: "pending",   method: "manual" },
      { groupId: weekendTrip.id, fromUserId: raluca.id, toUserId: rares.id,  amount: 30,  status: "completed", method: "manual" },
      { groupId: weekendTrip.id, fromUserId: ana.id,    toUserId: mihai.id,  amount: 65,  status: "completed", method: "manual" },
      { groupId: weekendTrip.id, fromUserId: rares.id,  toUserId: raluca.id, amount: 50,  status: "pending",   method: "manual" },
      { groupId: weekendTrip.id, fromUserId: mihai.id,  toUserId: rares.id,  amount: 35,  status: "failed",    method: "manual" },
      { groupId: weekendTrip.id, fromUserId: raluca.id, toUserId: mihai.id,  amount: 80,  status: "completed", method: "manual" },
      { groupId: weekendTrip.id, fromUserId: ana.id,    toUserId: rares.id,  amount: 70,  status: "pending",   method: "manual" },
      { groupId: weekendTrip.id, fromUserId: mihai.id,  toUserId: raluca.id, amount: 110, status: "completed", method: "manual" },
      { groupId: weekendTrip.id, fromUserId: rares.id,  toUserId: ana.id,    amount: 25,  status: "failed",    method: "manual" },
      { groupId: weekendTrip.id, fromUserId: raluca.id, toUserId: ana.id,    amount: 95,  status: "completed", method: "manual" },
      { groupId: weekendTrip.id, fromUserId: ana.id,    toUserId: raluca.id, amount: 120, status: "pending",   method: "manual" },
      { groupId: weekendTrip.id, fromUserId: mihai.id,  toUserId: ana.id,    amount: 40,  status: "completed", method: "manual" },
      { groupId: weekendTrip.id, fromUserId: rares.id,  toUserId: mihai.id,  amount: 55,  status: "pending",   method: "manual" },
      { groupId: weekendTrip.id, fromUserId: raluca.id, toUserId: rares.id,  amount: 85,  status: "failed",    method: "manual" },
      { groupId: weekendTrip.id, fromUserId: ana.id,    toUserId: mihai.id,  amount: 30,  status: "completed", method: "manual" },

      // Europe Trip — 22 payments
      { groupId: europeTrip.id, fromUserId: andrei.id,  toUserId: raluca.id,  amount: 150, status: "pending",   method: "manual" },
      { groupId: europeTrip.id, fromUserId: cristina.id, toUserId: raluca.id, amount: 200, status: "completed", method: "manual" },
      { groupId: europeTrip.id, fromUserId: rares.id,   toUserId: andrei.id,  amount: 90,  status: "failed",    method: "manual" },
      { groupId: europeTrip.id, fromUserId: andrei.id,  toUserId: cristina.id, amount: 120, status: "completed", method: "manual" },
      { groupId: europeTrip.id, fromUserId: cristina.id, toUserId: rares.id,  amount: 85,  status: "pending",   method: "manual" },
      { groupId: europeTrip.id, fromUserId: raluca.id,  toUserId: andrei.id,  amount: 60,  status: "completed", method: "manual" },
      { groupId: europeTrip.id, fromUserId: rares.id,   toUserId: raluca.id,  amount: 175, status: "completed", method: "manual" },
      { groupId: europeTrip.id, fromUserId: andrei.id,  toUserId: rares.id,   amount: 95,  status: "failed",    method: "manual" },
      { groupId: europeTrip.id, fromUserId: cristina.id, toUserId: andrei.id, amount: 140, status: "pending",   method: "manual" },
      { groupId: europeTrip.id, fromUserId: raluca.id,  toUserId: cristina.id, amount: 110, status: "completed", method: "manual" },
      { groupId: europeTrip.id, fromUserId: rares.id,   toUserId: cristina.id, amount: 65, status: "pending",   method: "manual" },
      { groupId: europeTrip.id, fromUserId: andrei.id,  toUserId: raluca.id,  amount: 80,  status: "completed", method: "manual" },
      { groupId: europeTrip.id, fromUserId: cristina.id, toUserId: raluca.id, amount: 55,  status: "failed",    method: "manual" },
      { groupId: europeTrip.id, fromUserId: raluca.id,  toUserId: rares.id,   amount: 45,  status: "completed", method: "manual" },
      { groupId: europeTrip.id, fromUserId: rares.id,   toUserId: andrei.id,  amount: 130, status: "pending",   method: "manual" },
      { groupId: europeTrip.id, fromUserId: andrei.id,  toUserId: cristina.id, amount: 75, status: "completed", method: "manual" },
      { groupId: europeTrip.id, fromUserId: cristina.id, toUserId: rares.id,  amount: 100, status: "failed",    method: "manual" },
      { groupId: europeTrip.id, fromUserId: raluca.id,  toUserId: andrei.id,  amount: 220, status: "pending",   method: "manual" },
      { groupId: europeTrip.id, fromUserId: rares.id,   toUserId: raluca.id,  amount: 50,  status: "completed", method: "manual" },
      { groupId: europeTrip.id, fromUserId: andrei.id,  toUserId: raluca.id,  amount: 160, status: "completed", method: "manual" },
      { groupId: europeTrip.id, fromUserId: cristina.id, toUserId: andrei.id, amount: 70,  status: "pending",   method: "manual" },
      { groupId: europeTrip.id, fromUserId: raluca.id,  toUserId: cristina.id, amount: 35, status: "failed",    method: "manual" },

      // Cluj Roommates — 20 payments
      { groupId: roommatesCluj.id, fromUserId: vlad.id,    toUserId: raluca.id,  amount: 100, status: "completed", method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: cristina.id, toUserId: vlad.id,   amount: 55,  status: "pending",   method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: raluca.id,  toUserId: vlad.id,    amount: 75,  status: "completed", method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: vlad.id,    toUserId: cristina.id, amount: 90, status: "failed",    method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: cristina.id, toUserId: raluca.id, amount: 40,  status: "completed", method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: raluca.id,  toUserId: cristina.id, amount: 65, status: "pending",   method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: vlad.id,    toUserId: raluca.id,  amount: 120, status: "completed", method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: cristina.id, toUserId: vlad.id,   amount: 85,  status: "completed", method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: raluca.id,  toUserId: vlad.id,    amount: 50,  status: "failed",    method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: vlad.id,    toUserId: cristina.id, amount: 35, status: "pending",   method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: cristina.id, toUserId: raluca.id, amount: 70,  status: "completed", method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: raluca.id,  toUserId: cristina.id, amount: 45, status: "completed", method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: vlad.id,    toUserId: raluca.id,  amount: 160, status: "pending",   method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: cristina.id, toUserId: vlad.id,   amount: 110, status: "failed",    method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: raluca.id,  toUserId: vlad.id,    amount: 30,  status: "completed", method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: vlad.id,    toUserId: cristina.id, amount: 200, status: "completed", method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: cristina.id, toUserId: raluca.id, amount: 25,  status: "pending",   method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: raluca.id,  toUserId: cristina.id, amount: 80, status: "failed",    method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: vlad.id,    toUserId: raluca.id,  amount: 95,  status: "completed", method: "manual" },
      { groupId: roommatesCluj.id, fromUserId: cristina.id, toUserId: vlad.id,   amount: 60,  status: "completed", method: "manual" },

      // Friends — 22 payments
      { groupId: friendsGroup.id, fromUserId: ana.id,    toUserId: mihai.id,  amount: 30,  status: "completed", method: "manual" },
      { groupId: friendsGroup.id, fromUserId: ioana.id,  toUserId: raluca.id, amount: 45,  status: "pending",   method: "manual" },
      { groupId: friendsGroup.id, fromUserId: vlad.id,   toUserId: ana.id,    amount: 25,  status: "failed",    method: "manual" },
      { groupId: friendsGroup.id, fromUserId: mihai.id,  toUserId: raluca.id, amount: 60,  status: "completed", method: "manual" },
      { groupId: friendsGroup.id, fromUserId: raluca.id, toUserId: mihai.id,  amount: 35,  status: "pending",   method: "manual" },
      { groupId: friendsGroup.id, fromUserId: ana.id,    toUserId: ioana.id,  amount: 50,  status: "completed", method: "manual" },
      { groupId: friendsGroup.id, fromUserId: ioana.id,  toUserId: vlad.id,   amount: 40,  status: "completed", method: "manual" },
      { groupId: friendsGroup.id, fromUserId: vlad.id,   toUserId: mihai.id,  amount: 70,  status: "failed",    method: "manual" },
      { groupId: friendsGroup.id, fromUserId: mihai.id,  toUserId: ana.id,    amount: 55,  status: "pending",   method: "manual" },
      { groupId: friendsGroup.id, fromUserId: raluca.id, toUserId: ioana.id,  amount: 20,  status: "completed", method: "manual" },
      { groupId: friendsGroup.id, fromUserId: ana.id,    toUserId: vlad.id,   amount: 65,  status: "completed", method: "manual" },
      { groupId: friendsGroup.id, fromUserId: ioana.id,  toUserId: mihai.id,  amount: 45,  status: "pending",   method: "manual" },
      { groupId: friendsGroup.id, fromUserId: vlad.id,   toUserId: raluca.id, amount: 80,  status: "completed", method: "manual" },
      { groupId: friendsGroup.id, fromUserId: mihai.id,  toUserId: ioana.id,  amount: 90,  status: "failed",    method: "manual" },
      { groupId: friendsGroup.id, fromUserId: raluca.id, toUserId: ana.id,    amount: 15,  status: "completed", method: "manual" },
      { groupId: friendsGroup.id, fromUserId: ana.id,    toUserId: mihai.id,  amount: 100, status: "pending",   method: "manual" },
      { groupId: friendsGroup.id, fromUserId: ioana.id,  toUserId: ana.id,    amount: 35,  status: "completed", method: "manual" },
      { groupId: friendsGroup.id, fromUserId: vlad.id,   toUserId: ioana.id,  amount: 55,  status: "failed",    method: "manual" },
      { groupId: friendsGroup.id, fromUserId: mihai.id,  toUserId: vlad.id,   amount: 75,  status: "pending",   method: "manual" },
      { groupId: friendsGroup.id, fromUserId: raluca.id, toUserId: vlad.id,   amount: 40,  status: "completed", method: "manual" },
      { groupId: friendsGroup.id, fromUserId: ana.id,    toUserId: raluca.id, amount: 110, status: "completed", method: "manual" },
      { groupId: friendsGroup.id, fromUserId: ioana.id,  toUserId: raluca.id, amount: 60,  status: "failed",    method: "manual" },

      // Family Vacation — 18 payments
      { groupId: familyGroup.id, fromUserId: andrei.id, toUserId: ioana.id,  amount: 180, status: "completed", method: "manual" },
      { groupId: familyGroup.id, fromUserId: maria.id,  toUserId: raluca.id, amount: 90,  status: "pending",   method: "manual" },
      { groupId: familyGroup.id, fromUserId: raluca.id, toUserId: ioana.id,  amount: 120, status: "completed", method: "manual" },
      { groupId: familyGroup.id, fromUserId: ioana.id,  toUserId: andrei.id, amount: 75,  status: "failed",    method: "manual" },
      { groupId: familyGroup.id, fromUserId: andrei.id, toUserId: maria.id,  amount: 60,  status: "pending",   method: "manual" },
      { groupId: familyGroup.id, fromUserId: maria.id,  toUserId: ioana.id,  amount: 95,  status: "completed", method: "manual" },
      { groupId: familyGroup.id, fromUserId: raluca.id, toUserId: maria.id,  amount: 50,  status: "completed", method: "manual" },
      { groupId: familyGroup.id, fromUserId: ioana.id,  toUserId: raluca.id, amount: 110, status: "pending",   method: "manual" },
      { groupId: familyGroup.id, fromUserId: andrei.id, toUserId: raluca.id, amount: 85,  status: "completed", method: "manual" },
      { groupId: familyGroup.id, fromUserId: maria.id,  toUserId: andrei.id, amount: 45,  status: "failed",    method: "manual" },
      { groupId: familyGroup.id, fromUserId: raluca.id, toUserId: andrei.id, amount: 200, status: "completed", method: "manual" },
      { groupId: familyGroup.id, fromUserId: ioana.id,  toUserId: maria.id,  amount: 130, status: "pending",   method: "manual" },
      { groupId: familyGroup.id, fromUserId: andrei.id, toUserId: ioana.id,  amount: 70,  status: "failed",    method: "manual" },
      { groupId: familyGroup.id, fromUserId: maria.id,  toUserId: raluca.id, amount: 155, status: "completed", method: "manual" },
      { groupId: familyGroup.id, fromUserId: raluca.id, toUserId: ioana.id,  amount: 40,  status: "pending",   method: "manual" },
      { groupId: familyGroup.id, fromUserId: ioana.id,  toUserId: andrei.id, amount: 65,  status: "completed", method: "manual" },
      { groupId: familyGroup.id, fromUserId: andrei.id, toUserId: maria.id,  amount: 115, status: "pending",   method: "manual" },
      { groupId: familyGroup.id, fromUserId: maria.id,  toUserId: ioana.id,  amount: 80,  status: "failed",    method: "manual" },
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
