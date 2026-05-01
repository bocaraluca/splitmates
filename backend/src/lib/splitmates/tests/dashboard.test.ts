import { beforeEach, describe, expect, it } from "vitest";
import {
  createExpense,
  createGroup,
  getDashboardSummary,
  getGroupStats,
  getUserRecordByIdentifier,
  getHealthSnapshot,
  startGenerator,
  stopGenerator,
  resetSplitmatesStateForTests,
} from "@/lib/splitmates";

beforeEach(() => {
  resetSplitmatesStateForTests();
});

describe("dashboard and stats", () => {
  it("returns overall balances and per-group summaries", () => {
    const creator = getUserRecordByIdentifier("raluca")!;
    const group = createGroup({ name: "Shared Home", category: "household" }, creator.id);

    createExpense(group.id, creator.id, {
      title: "Rent",
      amount: 600,
      currency: "RON",
      category: "rent",
      date: new Date().toISOString(),
      paidByUserId: creator.id,
      splitType: "equal",
      memberIds: [creator.id],
      shares: [],
    });

    const dashboard = getDashboardSummary(creator.id);
    const groupStats = getGroupStats(group.id);

    expect(dashboard.overall.totalSpent).toBeGreaterThan(0);
    expect(dashboard.groups.some((summary) => summary.groupId === group.id)).toBe(true);
    expect(groupStats?.totalSpent).toBeGreaterThan(0);
    expect(groupStats?.months).toHaveLength(6);
  });

  it("reports generator and health state", () => {
    const before = getHealthSnapshot();
    expect(before.users).toBeGreaterThan(0);

    const started = startGenerator();
    expect(started.running).toBe(true);

    const stopped = stopGenerator();
    expect(stopped.running).toBe(false);
  });
});

