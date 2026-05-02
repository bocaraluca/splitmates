import type { Id, ExpenseCategory, ExpenseListResponse, ExpenseShare, SplitType } from "../model/types";
import { emitEvent } from "../core/events";
import { buildEqualShares, normalizeShares, roundMoney } from "../core/math";
import { prisma } from "@/lib/prisma";

interface ExpenseInput {
  title: string;
  amount: number;
  currency: "RON";
  category: ExpenseCategory;
  date: string;
  paidByUserId: Id;
  splitType: SplitType;
  memberIds: Id[];
  shares: ExpenseShare[];
}

interface PaymentInput {
  groupId: Id;
  fromUserId: Id;
  toUserId: Id;
  amount: number;
  date?: string;
  note?: string;
}

async function ensureUserInGroup(groupId: Id, userId: Id) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true }
  });

  if (!group) {
    throw new Error("Group not found.");
  }

  if (!group.members.find(m => m.userId === userId)) {
    throw new Error("User is not a member of this group.");
  }

  return group;
}

async function ensureParticipantsBelongToGroup(groupId: Id, memberIds: Id[]) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true }
  });

  if (!group) {
    throw new Error("Group not found.");
  }

  const invalidMemberId = memberIds.find((memberId) => !group.members.find(m => m.userId === memberId));
  if (invalidMemberId) {
    throw new Error("All expense participants must be members of the group.");
  }

  return group;
}

export async function getExpenses(groupId: Id, page: number, pageSize: number, sortBy: "date" | "amount", sortOrder: "asc" | "desc", category?: ExpenseCategory, paidByUserId?: Id): Promise<ExpenseListResponse> {
  const where: any = { groupId };
  if (category) where.category = category;
  if (paidByUserId) where.paidByUserId = paidByUserId;

  const totalItems = await prisma.expense.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  const expenses = await prisma.expense.findMany({
    where,
    include: { paidByUser: true },
    orderBy: { [sortBy === "date" ? "date" : "amount"]: sortOrder },
    skip: (safePage - 1) * pageSize,
    take: pageSize
  });

  return {
    items: expenses.map((expense) => ({
      id: expense.id,
      title: expense.title,
      amount: parseFloat(expense.amount.toString()),
      currency: "RON" as const,
      date: expense.date.toISOString(),
      paidBy: { 
        id: expense.paidByUser.id, 
        username: expense.paidByUser.username,
        email: expense.paidByUser.email,
        createdAt: expense.paidByUser.createdAt.toISOString()
      },
      category: expense.category,
      splitType: expense.splitType,
    })),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
  };
}

export async function createExpense(groupId: Id, actorUserId: Id, input: ExpenseInput) {
  const group = await ensureUserInGroup(groupId, actorUserId);

  if (!group.members.find(m => m.userId === input.paidByUserId)) {
    throw new Error("The payer must be a group member.");
  }

  const memberIds = input.splitType === "equal" 
    ? (input.memberIds.length > 0 ? input.memberIds : group.members.map(m => m.userId)) 
    : input.shares.map((share) => share.userId);
  
  const validatedMemberIds = Array.from(new Set(memberIds));
  if (validatedMemberIds.length === 0) {
    throw new Error("At least one member is required for the split.");
  }

  await ensureParticipantsBelongToGroup(groupId, validatedMemberIds);

  const normalizedAmount = roundMoney(input.amount);
  const shares = input.splitType === "equal" 
    ? buildEqualShares(normalizedAmount, validatedMemberIds) 
    : normalizeShares(input.shares);

  const expense = await prisma.expense.create({
    data: {
      groupId,
      title: input.title,
      amount: normalizedAmount,
      category: input.category,
      date: new Date(input.date),
      paidByUserId: input.paidByUserId,
      splitType: input.splitType,
      participants: {
        create: shares.map(share => ({
          userId: share.userId,
          amount: share.amount
        }))
      }
    },
    include: { participants: true, paidByUser: true }
  });

  emitEvent("expense.created", expense);
  return expense;
}

export async function updateExpense(groupId: Id, expenseId: Id, actorUserId: Id, input: ExpenseInput) {
  const group = await ensureUserInGroup(groupId, actorUserId);

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { participants: true }
  });

  if (!expense || expense.groupId !== groupId) {
    return null;
  }

  const isAdmin = group.members.find(m => m.userId === actorUserId && m.isAdmin);
  if (!isAdmin && expense.paidByUserId !== actorUserId) {
    throw new Error("Only the group admin or the payer can edit this expense.");
  }

  const memberIds = input.splitType === "equal" 
    ? (input.memberIds.length > 0 ? input.memberIds : group.members.map(m => m.userId)) 
    : input.shares.map((share) => share.userId);
  
  const validatedMemberIds = Array.from(new Set(memberIds));
  if (validatedMemberIds.length === 0) {
    throw new Error("At least one member is required for the split.");
  }

  await ensureParticipantsBelongToGroup(groupId, validatedMemberIds);

  const normalizedAmount = roundMoney(input.amount);
  const shares = input.splitType === "equal" 
    ? buildEqualShares(normalizedAmount, validatedMemberIds) 
    : normalizeShares(input.shares);

  await prisma.expenseParticipant.deleteMany({ where: { expenseId } });

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      title: input.title,
      amount: normalizedAmount,
      category: input.category,
      date: new Date(input.date),
      paidByUserId: input.paidByUserId,
      splitType: input.splitType,
      participants: {
        create: shares.map(share => ({
          userId: share.userId,
          amount: share.amount
        }))
      }
    },
    include: { participants: true }
  });

  emitEvent("expense.updated", updated);
  return updated;
}

export async function deleteExpense(groupId: Id, expenseId: Id, actorUserId: Id) {
  const group = await ensureUserInGroup(groupId, actorUserId);

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId }
  });

  if (!expense || expense.groupId !== groupId) {
    return null;
  }

  const isAdmin = group.members.find(m => m.userId === actorUserId && m.isAdmin);
  if (!isAdmin && expense.paidByUserId !== actorUserId) {
    throw new Error("Only the group admin or the payer can delete this expense.");
  }

  const deleted = await prisma.expense.delete({
    where: { id: expenseId }
  });

  emitEvent("expense.deleted", deleted);
  return deleted;
}

export async function getExpenseDetailForGroup(groupId: Id, expenseId: Id, viewerUserId?: Id) {
  const group = await prisma.group.findUnique({
    where: { id: groupId }
  });

  if (!group) {
    return null;
  }

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { participants: { include: { user: true } }, paidByUser: true }
  });

  if (!expense || expense.groupId !== groupId) {
    return null;
  }

  const total = expense.participants.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
  const shares = expense.participants.map((participant) => ({
    userId: participant.userId,
    amount: parseFloat(participant.amount.toString()),
    user: { 
      id: participant.user.id, 
      username: participant.user.username,
      email: participant.user.email,
      createdAt: participant.user.createdAt.toISOString()
    },
    percent: total === 0 ? 0 : roundMoney((parseFloat(participant.amount.toString()) / total) * 100),
  }));

  return {
    expense: {
      id: expense.id,
      title: expense.title,
      amount: parseFloat(expense.amount.toString()),
      category: expense.category,
      date: expense.date.toISOString(),
      paidByUserId: expense.paidByUserId,
      splitType: expense.splitType,
      groupId: expense.groupId,
      createdAt: expense.createdAt.toISOString(),
    },
    payer: { 
      id: expense.paidByUser.id, 
      username: expense.paidByUser.username,
      email: expense.paidByUser.email,
      createdAt: expense.paidByUser.createdAt.toISOString()
    },
    shares,
    yourShare: Number(expense.participants.find((p) => p.userId === viewerUserId)?.amount ?? 0),
  };
}

export async function createPayment(groupId: Id, actorUserId: Id, input: Omit<PaymentInput, "groupId">) {
  const group = await ensureUserInGroup(groupId, actorUserId);

  if (!group.members.find(m => m.userId === input.fromUserId) || !group.members.find(m => m.userId === input.toUserId)) {
    throw new Error("Both payment users must belong to the group.");
  }

  const payment = await prisma.payment.create({
    data: {
      groupId,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      amount: roundMoney(input.amount),
      createdAt: input.date ? new Date(input.date) : new Date(),
    }
  });

  emitEvent("payment.created", payment);
  return payment;
}

export async function getPayments(groupId: Id) {
  return await prisma.payment.findMany({
    where: { groupId }
  });
}


