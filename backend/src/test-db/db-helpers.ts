import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function resetDatabase() {

  await prisma.session.deleteMany({});
  await prisma.expenseParticipant.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.user.deleteMany({});
}

export async function createTestUser(username: string, email: string, password = "secret123") {
  const userRole = await prisma.role.upsert({
    where: { title: "user" },
    update: {},
    create: { title: "user" },
  });

  return prisma.user.create({
    data: {
      username,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      roleId: userRole.id,
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
