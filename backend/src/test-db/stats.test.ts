import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createExpense, deleteExpense, createPayment } from "@/lib/splitmates/services/expenses-service";
import { getGroupStats, getDashboardSummary } from "@/lib/splitmates/services/statistics-service";
import { createTestGroup, createTestUser, resetDatabase } from "./db-helpers";

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
});

async function setupGroup() {
  const raluca = await createTestUser("raluca", "raluca@gmail.com");
  const ana = await createTestUser("ana", "ana@gmail.com");
  const group = await createTestGroup("Apartment", raluca.id, [raluca.id, ana.id], [raluca.id]);
  return { raluca, ana, group };
}

describe("group statistics", () => {
  it("totalSpent is the sum of all expenses in the group", async () => {
    const { raluca, ana, group } = await setupGroup();
    const date = new Date().toISOString();
    const memberIds = [raluca.id, ana.id];
    const baseInput = { currency: "RON" as const, date, paidByUserId: raluca.id, splitType: "equal" as const, memberIds, shares: [] };

    await createExpense(group.id, raluca.id, { ...baseInput, title: "Rent", amount: 1500, category: "rent" });
    await createExpense(group.id, raluca.id, { ...baseInput, title: "Bread", amount: 100, category: "groceries" });
    await createExpense(group.id, raluca.id, { ...baseInput, title: "Internet", amount: 50, category: "utilities" });

    const stats = await getGroupStats(group.id);
    expect(stats!.totalSpent).toBeCloseTo(1650, 2);
  });

  it("totalSpent updates after deleting an expense", async () => {
    const { raluca, ana, group } = await setupGroup();
    const date = new Date().toISOString();
    const memberIds = [raluca.id, ana.id];
    const baseInput = { currency: "RON" as const, date, paidByUserId: raluca.id, splitType: "equal" as const, memberIds, shares: [] };

    const rent = await createExpense(group.id, raluca.id, { ...baseInput, title: "Rent", amount: 1500, category: "rent" });
    await createExpense(group.id, raluca.id, { ...baseInput, title: "Bread", amount: 100, category: "groceries" });

    let stats = await getGroupStats(group.id);
    expect(stats!.totalSpent).toBeCloseTo(1600, 2);

    await deleteExpense(group.id, rent.id, raluca.id);

    stats = await getGroupStats(group.id);
    expect(stats!.totalSpent).toBeCloseTo(100, 2);
  });

  it("returns the most expensive category", async () => {
    const { raluca, ana, group } = await setupGroup();
    const date = new Date().toISOString();
    const memberIds = [raluca.id, ana.id];
    const baseInput = { currency: "RON" as const, date, paidByUserId: raluca.id, splitType: "equal" as const, memberIds, shares: [] };

    await createExpense(group.id, raluca.id, { ...baseInput, title: "Rent", amount: 1500, category: "rent" });
    await createExpense(group.id, raluca.id, { ...baseInput, title: "Bread", amount: 50, category: "groceries" });
    await createExpense(group.id, raluca.id, { ...baseInput, title: "Wine", amount: 30, category: "groceries" });

    const stats = await getGroupStats(group.id);
    expect(stats!.mostExpensiveCategory).toBe("rent");
    expect(stats!.topCategoryAmount).toBeCloseTo(1500, 2);
  });

  it("computes category percentages that sum to 100", async () => {
    const { raluca, ana, group } = await setupGroup();
    const date = new Date().toISOString();
    const memberIds = [raluca.id, ana.id];
    const baseInput = { currency: "RON" as const, date, paidByUserId: raluca.id, splitType: "equal" as const, memberIds, shares: [] };

    await createExpense(group.id, raluca.id, { ...baseInput, title: "A", amount: 100, category: "rent" });
    await createExpense(group.id, raluca.id, { ...baseInput, title: "B", amount: 100, category: "groceries" });

    const stats = await getGroupStats(group.id);
    const total = stats!.categories.reduce((sum, cat) => sum + cat.percentage, 0);
    expect(total).toBeCloseTo(100, 1);
  });
});

describe("statistics edge cases and balances", () => {
  it("resolves balances correctly when users pay and exact debts are settled", async () => {
    const { raluca, ana, group } = await setupGroup();

    await createExpense(group.id, raluca.id, {
      title: "Dinner", amount: 100, currency: "RON", category: "food", 
      date: new Date().toISOString(), paidByUserId: raluca.id, splitType: "equal", 
      memberIds: [raluca.id, ana.id], shares: []
    });

    await createPayment(group.id, ana.id, {
      fromUserId: ana.id, toUserId: raluca.id, amount: 50
    });

    const stats = await getGroupStats(group.id);

    expect(stats!.balance.net).toBe(0);
    expect(stats!.balance.othersOweToYou).toHaveLength(0);
    expect(stats!.balance.youOweTo).toHaveLength(0);
  });

  it("returns null for invalid or missing group IDs", async () => {
    expect(await getGroupStats(NaN as any)).toBeNull();
    expect(await getGroupStats(999999)).toBeNull();
  });

  it("handles missing user profiles during balance lookup gracefully", async () => {
    const { raluca, ana, group } = await setupGroup();

    await createExpense(group.id, raluca.id, {
      title: "Dinner", amount: 100, currency: "RON", category: "food", 
      date: new Date().toISOString(), paidByUserId: raluca.id, splitType: "equal", 
      memberIds: [raluca.id, ana.id], shares: []
    });

    vi.spyOn(prisma.user, "findMany").mockResolvedValueOnce([]);

    const stats = await getGroupStats(group.id);

    expect(stats!.balance.youOweTo).toHaveLength(0);
    expect(stats!.balance.othersOweToYou).toHaveLength(0);
  });
});

describe("dashboard summaries", () => {
  it("aggregates data across multiple groups for a user", async () => {
    const { raluca, ana, group: group1 } = await setupGroup();
    const elena = await createTestUser("elena", "elena@example.com");
    const group2 = await createTestGroup("Trip", raluca.id, [raluca.id, elena.id], [raluca.id]);

    await createExpense(group1.id, raluca.id, {
      title: "Rent", amount: 100, currency: "RON", category: "rent", 
      date: new Date().toISOString(), paidByUserId: raluca.id, splitType: "equal", 
      memberIds: [raluca.id, ana.id], shares: []
    });

    await createExpense(group2.id, elena.id, {
      title: "Gas", amount: 40, currency: "RON", category: "transport", 
      date: new Date().toISOString(), paidByUserId: elena.id, splitType: "equal", 
      memberIds: [raluca.id, elena.id], shares: []
    });

    const dashboard = await getDashboardSummary(raluca.id);

    expect(dashboard.user.username).toBe("raluca");
    expect(dashboard.groups).toHaveLength(2);

    expect(dashboard.overall.totalOwedToYou).toBe(50);
    expect(dashboard.overall.totalYouOwe).toBe(20);
    expect(dashboard.overall.net).toBe(30);
  });

  it("throws an error if getting a dashboard for a non-existent user", async () => {
    await expect(getDashboardSummary(999999)).rejects.toThrow("User not found.");
  });
});