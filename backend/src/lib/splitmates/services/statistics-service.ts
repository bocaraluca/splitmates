import type {
  CategoryStat,
  UserBalance,
  DashboardSummary,
  Id,
  ExpenseCategory,
  GroupStats,
  MonthStat,
  BalanceSummary,
} from "../model/types";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "../core/math";

type BalanceMap = Map<number, Map<number, number>>;

const toNum = (id?: Id): number | undefined => (id !== undefined ? Number(id) : undefined);

function parseAmount(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}

async function buildBalanceMap(groupId?: Id): Promise<BalanceMap> {
  const balances: BalanceMap = new Map();
  const numGroupId = toNum(groupId);

  const touch = (fromUserId: number, toUserId: number, amount: number) => {
    if (!balances.has(fromUserId)) {
      balances.set(fromUserId, new Map<number, number>());
    }

    const row = balances.get(fromUserId)!;
    row.set(toUserId, roundMoney((row.get(toUserId) ?? 0) + amount));
  };

  const expenses = await prisma.expense.findMany({
    where: numGroupId ? { groupId: numGroupId } : undefined,
    include: { participants: true },
  });

  for (const expense of expenses) {
    const paidById = Number(expense.paidByUserId);
    for (const participant of expense.participants) {
      const partUserId = Number(participant.userId);
      if (partUserId === paidById) {
        continue;
      }
      
      const amount = parseAmount(participant.amount);
      touch(partUserId, paidById, amount);
    }
  }

  const payments = await prisma.payment.findMany({
    where: {
      ...(numGroupId ? { groupId: numGroupId } : {}),
      status: "completed",
    },
  });

  for (const payment of payments) {
    const amount = parseAmount(payment.amount);
    touch(Number(payment.fromUserId), Number(payment.toUserId), -amount);
  }

  return simplifyDebts(balances);
}

function simplifyDebts(balances: BalanceMap): BalanceMap {
  // Calculate net balance per user (positive = owed money, negative = owes money)
  const net = new Map<number, number>();

  for (const [fromId, row] of balances.entries()) {
    for (const [toId, amount] of row.entries()) {
      if (Math.abs(amount) < 0.005) continue;
      net.set(fromId, roundMoney((net.get(fromId) ?? 0) - amount));
      net.set(toId, roundMoney((net.get(toId) ?? 0) + amount));
    }
  }

  // Split into debtors (owe money) and creditors (are owed money)
  const debtors: { id: number; amount: number }[] = [];
  const creditors: { id: number; amount: number }[] = [];

  for (const [userId, balance] of net.entries()) {
    if (balance < -0.005) debtors.push({ id: userId, amount: roundMoney(-balance) });
    else if (balance > 0.005) creditors.push({ id: userId, amount: balance });
  }

  // Greedy matching — minimizes number of transactions
  const simplified: BalanceMap = new Map();
  const touch = (fromId: number, toId: number, amount: number) => {
    if (!simplified.has(fromId)) simplified.set(fromId, new Map());
    simplified.get(fromId)!.set(toId, roundMoney((simplified.get(fromId)!.get(toId) ?? 0) + amount));
  };

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = roundMoney(Math.min(debtor.amount, creditor.amount));

    if (amount > 0.005) {
      touch(debtor.id, creditor.id, amount);
    }

    debtor.amount = roundMoney(debtor.amount - amount);
    creditor.amount = roundMoney(creditor.amount - amount);

    if (debtor.amount < 0.005) i++;
    if (creditor.amount < 0.005) j++;
  }

  return simplified;
}

export async function balanceSummaryForUser(userId: Id, groupId?: Id): Promise<BalanceSummary> {
  const numUserId = Number(userId);
  const numGroupId = toNum(groupId);
  
  const balances = await buildBalanceMap(numGroupId);
  const youOweTo: UserBalance[] = [];
  const othersOweToYou: UserBalance[] = [];
  let totalYouOwe = 0;
  let totalOwedToYou = 0;
  let totalSpent = 0;

  const expenses = await prisma.expense.findMany({
    where: numGroupId 
      ? { groupId: numGroupId, paidByUserId: numUserId } 
      : { paidByUserId: numUserId },
  });

  for (const expense of expenses) {
    totalSpent = roundMoney(totalSpent + parseAmount(expense.amount));
  }

  const uniqueUserIds = new Set<number>();
  for (const [fromId, row] of balances.entries()) {
    uniqueUserIds.add(fromId);
    for (const toId of row.keys()) {
      uniqueUserIds.add(toId);
    }
  }

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(uniqueUserIds) } }
  });
  const userLookup = new Map(users.map(u => [u.id, u]));

  for (const [fromUserId, row] of balances.entries()) {
    const fromUser = userLookup.get(fromUserId);

    for (const [toUserId, amount] of row.entries()) {
      const toUser = userLookup.get(toUserId);
      
      if (!fromUser || !toUser) continue;

      if (fromUserId === numUserId) {
        totalYouOwe = roundMoney(totalYouOwe + amount);
        youOweTo.push({ userId: toUser.id, username: toUser.username, email: toUser.email, wiseEmail: toUser.wiseEmail ?? null, amount });
      }

      if (toUserId === numUserId) {
        totalOwedToYou = roundMoney(totalOwedToYou + amount);
        othersOweToYou.push({ userId: fromUser.id, username: fromUser.username, email: fromUser.email, wiseEmail: fromUser.wiseEmail ?? null, amount });
      }
    }
  }

  return {
    totalSpent,
    totalYouOwe,
    totalOwedToYou,
    net: roundMoney(totalOwedToYou - totalYouOwe),
    youOweTo,
    othersOweToYou,
  };
}

async function calculateCategoryStats(groupId: Id) {
  const amounts = new Map<ExpenseCategory, number>();
  let totalSpent = 0;
  const numGroupId = Number(groupId);

  const expenses = await prisma.expense.findMany({
    where: { groupId: numGroupId },
  });

  for (const expense of expenses) {
    const amount = parseAmount(expense.amount);
    totalSpent = roundMoney(totalSpent + amount);
    amounts.set(expense.category, roundMoney((amounts.get(expense.category) ?? 0) + amount));
  }

  const categories: CategoryStat[] = Array.from(amounts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpent === 0 ? 0 : roundMoney((amount / totalSpent) * 100),
    }));

  return { totalSpent, categories };
}

async function calculateMonthlyStats(groupId: Id) {
  const months: MonthStat[] = [];
  const monthKeys: string[] = [];
  const now = new Date();
  const numGroupId = Number(groupId);

  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    monthKeys.push(key);
    months.push({ month: monthDate.toLocaleString("en-US", { month: "short" }), amount: 0 });
  }

  const expenses = await prisma.expense.findMany({
    where: { groupId: numGroupId },
  });

  for (const expense of expenses) {
    const date = new Date(expense.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const index = monthKeys.indexOf(key);
    
    if (index >= 0) {
      const amount = parseAmount(expense.amount);
      months[index].amount = roundMoney(months[index].amount + amount);
    }
  }

  return months;
}

export async function getGroupStats(groupId: Id): Promise<GroupStats | null> {
  const numGroupId = Number(groupId);

  if (isNaN(numGroupId)) {
    return null;
  }

  const group = await prisma.group.findUnique({
    where: { id: numGroupId },
    include: { members: true },
  });

  if (!group) {
    return null;
  }

  const { totalSpent, categories } = await calculateCategoryStats(numGroupId);
  const months = await calculateMonthlyStats(numGroupId);
  const topCategory = categories[0] ?? null;
  
  const firstMemberId = group.members[0]?.userId ? Number(group.members[0].userId) : 0;
  const balance = await balanceSummaryForUser(firstMemberId, numGroupId);

  return {
    group: {
      id: group.id,
      name: group.name,
      description: group.description ?? undefined,
      category: group.category,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.createdAt.toISOString(),
      memberIds: group.members.map((m) => m.userId),
      adminIds: group.members.filter((m) => m.isAdmin).map((m) => m.userId),
    },
    totalSpent,
    mostExpensiveCategory: topCategory?.category ?? null,
    topCategoryAmount: topCategory?.amount ?? 0,
    categories,
    months,
    balance,
  };
}

export async function getDashboardSummary(userId: Id): Promise<DashboardSummary> {
  const numUserId = Number(userId);

  const user = await prisma.user.findUnique({
    where: { id: numUserId },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const groups = await prisma.group.findMany({
    where: {
      members: {
        some: { userId: numUserId },
      },
    },
  });

  const groupSummaries = await Promise.all(
    groups.map(async (group) => ({
      groupId: group.id,
      groupName: group.name,
      category: group.category,
      ...(await balanceSummaryForUser(numUserId, group.id)),
    }))
  );

  const overall = await balanceSummaryForUser(numUserId);

  return {
    user: { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt.toISOString() },
    overall,
    groups: groupSummaries,
  };
}