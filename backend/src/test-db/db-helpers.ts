import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function resetDatabase() {
  // Delete in the correct order to respect foreign key constraints
  await prisma.session.deleteMany({});
  await prisma.expenseParticipant.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.user.deleteMany({});
}

export async function createTestUser(username: string, email: string, password = "secret123") {
  return prisma.user.create({
    data: {
      username,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
    },
  });
}

export async function createTestGroup(name: string, createdByUserId: number, memberIds: number[], adminIds: number[] = []) {
  return prisma.group.create({
    data: {
      name,
      category: "household",
      createdByUserId,
      members: {
        create: memberIds.map((userId) => ({
          userId,
          isAdmin: adminIds.includes(userId),
        })),
      },
    },
    include: { members: true },
  });
}
