export * from "./model/types";
export * from "./core/state";
export * from "./core/events";
export * from "./core/math";
export * from "./services/auth/session-service";
export * from "./services/auth/login-service";
export * from "./services/auth/signup-service";
export * from "./services/groups-service";
export * from "./services/expenses-service";
export * from "./services/statistics-service";
export * from "./services/generator/status-service";
export * from "./services/generator/generator-service";
export * from "./services/generator/health-service";

import { prisma } from "@/lib/prisma";

function toUser(user: { id: number; username: string; email: string; createdAt: Date } | null) {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getUsers() {
  const users = await prisma.user.findMany();
  return users.map((user) => toUser(user)!);
}

export async function getUserById(userId: number) {
  return toUser(await prisma.user.findUnique({ where: { id: userId } }));
}

export async function getUserByIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return toUser(
    await prisma.user.findFirst({
      where: { OR: [{ username: normalized }, { email: normalized }] },
    }),
  );
}

export async function getUserRecordByIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return prisma.user.findFirst({
    where: { OR: [{ username: normalized }, { email: normalized }] },
  });
}

export async function getUserRecordById(userId: number) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function getGroupById(groupId: number) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });
  if (!group) {
    return null;
  }
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    category: group.category,
    createdAt: group.createdAt,
    updatedAt: group.createdAt,
    memberIds: group.members.map((m) => m.userId),
    adminIds: group.members.filter((m) => m.isAdmin).map((m) => m.userId),
  };
}

export async function getExpenseById(expenseId: number) {
  return prisma.expense.findUnique({
    where: { id: expenseId },
    include: { participants: true },
  });
}

export async function getPaymentById(paymentId: number) {
  return prisma.payment.findUnique({ where: { id: paymentId } });
}

export async function getSeedUsers() {
  return getUsers();
}
