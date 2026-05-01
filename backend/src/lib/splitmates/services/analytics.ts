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
import { findGroupById, findUserById, toUser, getState } from "../core/state";
import { roundMoney } from "../core/math";

type NumericBalanceMap = Map<Id, Map<Id, number>>;

function buildBalanceMap(groupId?: Id): NumericBalanceMap {
  const state = getState();
  const balances: NumericBalanceMap = new Map();

  const touch = (fromUserId: Id, toUserId: Id, amount: number) => {
    if (!balances.has(fromUserId)) {
      balances.set(fromUserId, new Map<Id, number>());
    }

    const row = balances.get(fromUserId)!;
    row.set(toUserId, roundMoney((row.get(toUserId) ?? 0) + amount));
  };

  for (const expense of state.expenses) {
    if (groupId && expense.groupId !== groupId) {
      continue;
    }

    for (const share of expense.shares) {
      if (share.userId === expense.paidByUserId) {
        continue;
      }

      touch(share.userId, expense.paidByUserId, share.amount);
    }
  }

  for (const settlement of state.settlements) {
    if (groupId && settlement.groupId !== groupId) {
      continue;
    }

    touch(settlement.fromUserId, settlement.toUserId, -settlement.amount);
  }

  for (const [fromUserId, row] of balances.entries()) {
    for (const [toUserId, amount] of row.entries()) {
      if (Math.abs(amount) < 0.005) {
        row.delete(toUserId);
      }
    }

    if (row.size === 0) {
      balances.delete(fromUserId);
    }
  }

  return balances;
}

export function balanceSummaryForUser(userId: Id, groupId?: Id): BalanceSummary {
  const state = getState();
  const balances = buildBalanceMap(groupId);
  const youOweTo: UserBalance[] = [];
  const othersOweToYou: UserBalance[] = [];
  let totalYouOwe = 0;
  let totalOwedToYou = 0;
  let totalSpent = 0;

  for (const expense of state.expenses) {
    if (groupId && expense.groupId !== groupId) {
      continue;
    }

    if (expense.paidByUserId === userId) {
      totalSpent = roundMoney(totalSpent + expense.amount);
    }
  }

  for (const [fromUserId, row] of balances.entries()) {
    const fromUser = findUserById(fromUserId);

    for (const [toUserId, amount] of row.entries()) {
      const toUser = findUserById(toUserId);
      if (!fromUser || !toUser) {
        continue;
      }

      if (fromUserId === userId) {
        totalYouOwe = roundMoney(totalYouOwe + amount);
        youOweTo.push({ userId: toUser.id, username: toUser.username, email: toUser.email, amount });
      }

      if (toUserId === userId) {
        totalOwedToYou = roundMoney(totalOwedToYou + amount);
        othersOweToYou.push({ userId: fromUser.id, username: fromUser.username, email: fromUser.email, amount });
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

function calculateCategoryStats(groupId: Id) {
  const state = getState();
  const amounts = new Map<ExpenseCategory, number>();
  let totalSpent = 0;

  for (const expense of state.expenses) {
    if (expense.groupId !== groupId) {
      continue;
    }

    totalSpent = roundMoney(totalSpent + expense.amount);
    amounts.set(expense.category, roundMoney((amounts.get(expense.category) ?? 0) + expense.amount));
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

function calculateMonthlyStats(groupId: Id) {
  const state = getState();
  const months: MonthStat[] = [];
  const monthKeys: string[] = [];
  const now = new Date();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    monthKeys.push(key);
    months.push({ month: monthDate.toLocaleString("en-US", { month: "short" }), amount: 0 });
  }

  for (const expense of state.expenses) {
    if (expense.groupId !== groupId) {
      continue;
    }

    const date = new Date(expense.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const index = monthKeys.indexOf(key);
    if (index >= 0) {
      months[index].amount = roundMoney(months[index].amount + expense.amount);
    }
  }

  return months;
}

export function getGroupStats(groupId: Id): GroupStats | null {
  const group = findGroupById(groupId);
  if (!group) {
    return null;
  }

  const { totalSpent, categories } = calculateCategoryStats(groupId);
  const months = calculateMonthlyStats(groupId);
  const topCategory = categories[0] ?? null;
  const balance = balanceSummaryForUser(group.memberIds[0] ?? group.adminIds[0] ?? "", groupId);

  return {
    group,
    totalSpent,
    mostExpensiveCategory: topCategory?.category ?? null,
    topCategoryAmount: topCategory?.amount ?? 0,
    categories,
    months,
    balance,
  };
}

export function getDashboardSummary(userId: Id): DashboardSummary {
  const user = findUserById(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const groups = getState().groups
    .filter((group) => group.memberIds.includes(userId))
    .map((group) => ({
      groupId: group.id,
      groupName: group.name,
      category: group.category,
      ...balanceSummaryForUser(userId, group.id),
    }));

  const overall = balanceSummaryForUser(userId);

  return {
    user: toUser(user)!,
    overall,
    groups,
  };
}



