import type { Id, ExpenseShare } from "../model/types";

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildEqualShares(amount: number, memberIds: Id[]): ExpenseShare[] {
  if (memberIds.length === 0) {
    return [];
  }

  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents % memberIds.length;

  return memberIds.map((userId, index) => ({
    userId,
    amount: roundMoney((baseCents + (index < remainder ? 1 : 0)) / 100),
  }));
}

export function normalizeShares(shares: ExpenseShare[]) {
  const totals = new Map<Id, number>();

  for (const share of shares) {
    totals.set(share.userId, roundMoney((totals.get(share.userId) ?? 0) + share.amount));
  }

  return Array.from(totals.entries()).map(([userId, amount]) => ({ userId, amount }));
}

export function sortExpenses<T extends { amount: number; date: string }>(items: T[], sortBy: "date" | "amount", sortOrder: "asc" | "desc") {
  return [...items].sort((left, right) => {
    const direction = sortOrder === "asc" ? 1 : -1;

    if (sortBy === "amount") {
      return (left.amount - right.amount) * direction;
    }

    return (new Date(left.date).getTime() - new Date(right.date).getTime()) * direction;
  });
}