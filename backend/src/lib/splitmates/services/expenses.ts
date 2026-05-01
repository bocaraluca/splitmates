import type { Id, ExpenseCategory, ExpenseListResponse, Expense, ExpenseShare, SplitType } from "../model/types";
import { emitEvent } from "../core/events";
import { buildEqualShares, normalizeShares, roundMoney, sortExpenses } from "../core/math";
import { findExpenseById, findGroupById, findUserById, getState, nextId, toUser } from "../core/state";

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

interface SettlementInput {
  groupId: Id;
  fromUserId: Id;
  toUserId: Id;
  amount: number;
  date?: string;
  note?: string;
}

function ensureUserInGroup(groupId: Id, userId: Id) {
  const group = findGroupById(groupId);
  if (!group) {
    throw new Error("Group not found.");
  }

  if (!group.memberIds.includes(userId)) {
    throw new Error("User is not a member of this group.");
  }

  return group;
}

function ensureParticipantsBelongToGroup(groupId: Id, memberIds: Id[]) {
  const group = findGroupById(groupId);
  if (!group) {
    throw new Error("Group not found.");
  }

  const invalidMemberId = memberIds.find((memberId) => !group.memberIds.includes(memberId));
  if (invalidMemberId) {
    throw new Error("All expense participants must be members of the group.");
  }

  return group;
}

function recordExpense(input: Omit<Expense, "id" | "createdAt" | "updatedAt">) {
  const state = getState();
  const now = new Date().toISOString();
  const expense: Expense = {
    ...input,
    id: nextId("expense"),
    createdAt: now,
    updatedAt: now,
    amount: roundMoney(input.amount),
    shares: normalizeShares(input.shares),
  };

  state.expenses.push(expense);
  emitEvent("expense.created", expense);
  return expense;
}

function recordSettlement(input: SettlementInput) {
  const state = getState();
  const now = new Date().toISOString();
  const settlement = {
    id: nextId("settlement"),
    groupId: input.groupId,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    amount: roundMoney(input.amount),
    note: input.note,
    date: input.date ?? now,
    createdAt: now,
  };

  state.settlements.push(settlement);
  emitEvent("settlement.created", settlement);
  return settlement;
}

export function listExpenses(groupId: Id, page: number, pageSize: number, sortBy: "date" | "amount", sortOrder: "asc" | "desc", category?: ExpenseCategory, paidByUserId?: Id): ExpenseListResponse {
  const filtered = sortExpenses(
    getState().expenses.filter((expense) => {
      if (expense.groupId !== groupId) {
        return false;
      }

      if (category && expense.category !== category) {
        return false;
      }

      if (paidByUserId && expense.paidByUserId !== paidByUserId) {
        return false;
      }

      return true;
    }),
    sortBy,
    sortOrder,
  );

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  return {
    items: pageItems.map((expense) => ({
      id: expense.id,
      title: expense.title,
      amount: expense.amount,
      currency: expense.currency,
      date: expense.date,
      paidBy: toUser(findUserById(expense.paidByUserId)),
      category: expense.category,
      splitType: expense.splitType,
    })),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
  };
}

export function createExpense(groupId: Id, actorUserId: Id, input: ExpenseInput) {
  const group = ensureUserInGroup(groupId, actorUserId);
  if (!group.memberIds.includes(input.paidByUserId)) {
    throw new Error("The payer must be a group member.");
  }

  const memberIds = input.splitType === "equal" ? (input.memberIds.length > 0 ? input.memberIds : group.memberIds) : input.shares.map((share) => share.userId);
  const validatedMemberIds = Array.from(new Set(memberIds));
  if (validatedMemberIds.length === 0) {
    throw new Error("At least one member is required for the split.");
  }

  ensureParticipantsBelongToGroup(groupId, validatedMemberIds);

  return recordExpense({
    groupId,
    title: input.title,
    amount: input.amount,
    currency: input.currency,
    category: input.category,
    date: input.date,
    paidByUserId: input.paidByUserId,
    splitType: input.splitType,
    memberIds: validatedMemberIds,
    shares: input.splitType === "equal" ? buildEqualShares(input.amount, validatedMemberIds) : normalizeShares(input.shares),
  });
}

export function updateExpense(groupId: Id, expenseId: Id, actorUserId: Id, input: ExpenseInput) {
  const group = ensureUserInGroup(groupId, actorUserId);
  const expense = findExpenseById(expenseId);
  if (!expense || expense.groupId !== groupId) {
    return null;
  }

  if (!group.adminIds.includes(actorUserId) && expense.paidByUserId !== actorUserId) {
    throw new Error("Only the group admin or the payer can edit this expense.");
  }

  const memberIds = input.splitType === "equal" ? (input.memberIds.length > 0 ? input.memberIds : group.memberIds) : input.shares.map((share) => share.userId);
  const validatedMemberIds = Array.from(new Set(memberIds));
  if (validatedMemberIds.length === 0) {
    throw new Error("At least one member is required for the split.");
  }

  ensureParticipantsBelongToGroup(groupId, validatedMemberIds);

  expense.title = input.title;
  expense.amount = roundMoney(input.amount);
  expense.currency = input.currency;
  expense.category = input.category;
  expense.date = input.date;
  expense.paidByUserId = input.paidByUserId;
  expense.splitType = input.splitType;
  expense.memberIds = validatedMemberIds;
  expense.shares = input.splitType === "equal" ? buildEqualShares(expense.amount, validatedMemberIds) : normalizeShares(input.shares);
  expense.updatedAt = new Date().toISOString();

  emitEvent("expense.updated", expense);
  return expense;
}

export function deleteExpense(groupId: Id, expenseId: Id, actorUserId: Id) {
  const group = ensureUserInGroup(groupId, actorUserId);
  const expense = findExpenseById(expenseId);
  if (!expense || expense.groupId !== groupId) {
    return null;
  }

  if (!group.adminIds.includes(actorUserId) && expense.paidByUserId !== actorUserId) {
    throw new Error("Only the group admin or the payer can delete this expense.");
  }

  const state = getState();
  const index = state.expenses.findIndex((item) => item.id === expenseId);
  if (index < 0) {
    return null;
  }

  const [removed] = state.expenses.splice(index, 1);
  emitEvent("expense.deleted", removed);
  return removed;
}

export function getExpenseDetailForGroup(groupId: Id, expenseId: Id, viewerUserId?: Id) {
  const group = findGroupById(groupId);
  if (!group) {
    return null;
  }

  const expense = findExpenseById(expenseId);
  if (!expense || expense.groupId !== groupId) {
    return null;
  }

  const total = expense.shares.reduce((sum, share) => sum + share.amount, 0);
  const shares = expense.shares.map((share) => ({
    ...share,
    user: toUser(findUserById(share.userId)),
    percent: total === 0 ? 0 : roundMoney((share.amount / total) * 100),
  }));

  return {
    expense,
    payer: toUser(findUserById(expense.paidByUserId)),
    shares,
    yourShare: expense.shares.find((share) => share.userId === viewerUserId)?.amount ?? 0,
  };
}

export function createSettlement(groupId: Id, actorUserId: Id, input: Omit<SettlementInput, "groupId">) {
  const group = ensureUserInGroup(groupId, actorUserId);
  if (!group.memberIds.includes(input.fromUserId) || !group.memberIds.includes(input.toUserId)) {
    throw new Error("Both settlement users must belong to the group.");
  }

  return recordSettlement({ groupId, ...input });
}

export function listSettlements(groupId: Id) {
  return getState().settlements.filter((settlement) => settlement.groupId === groupId);
}

