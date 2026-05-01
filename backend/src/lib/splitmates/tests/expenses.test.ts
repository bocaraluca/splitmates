import { beforeEach, describe, expect, it } from "vitest";
import {
  addMemberToGroup,
  createExpense,
  createGroup,
  deleteExpense,
  getExpenseDetailForGroup,
  getUserRecordByIdentifier,
  listExpenses,
  resetSplitmatesStateForTests,
  updateExpense,
} from "@/lib/splitmates";

beforeEach(() => {
  resetSplitmatesStateForTests();
});

describe("expense workflows", () => {
  it("creates paginated expenses and exposes expense details", () => {
    const creator = getUserRecordByIdentifier("raluca")!;
    const group = createGroup({ name: "Bills", category: "household" }, creator.id);
    addMemberToGroup(group.id, "ana", creator.id);
    const ana = getUserRecordByIdentifier("ana")!;

    const expense = createExpense(group.id, creator.id, {
      title: "Electricity",
      amount: 123.45,
      currency: "RON",
      category: "utilities",
      date: new Date().toISOString(),
      paidByUserId: creator.id,
      splitType: "equal",
      memberIds: [creator.id, ana.id],
      shares: [],
    });

    const page = listExpenses(group.id, 1, 5, "amount", "desc");
    expect(page.totalItems).toBeGreaterThan(0);

    const detail = getExpenseDetailForGroup(group.id, expense.id, creator.id);
    expect(detail?.expense.id).toBe(expense.id);
    expect(detail?.shares.length).toBe(2);
  });

  it("prevents non members from splitting an expense", () => {
    const creator = getUserRecordByIdentifier("raluca")!;
    const group = createGroup({ name: "Trip", category: "trip" }, creator.id);

    expect(() =>
      createExpense(group.id, creator.id, {
        title: "Hotel",
        amount: 300,
        currency: "RON",
        category: "other",
        date: new Date().toISOString(),
        paidByUserId: creator.id,
        splitType: "equal",
        memberIds: [creator.id, 999],
        shares: [],
      }),
    ).toThrow("All expense participants must be members of the group.");
  });

  it("allows admin or payer updates and deletes", () => {
    const creator = getUserRecordByIdentifier("raluca")!;
    const group = createGroup({ name: "Food", category: "friends" }, creator.id);
    const expense = createExpense(group.id, creator.id, {
      title: "Lunch",
      amount: 30,
      currency: "RON",
      category: "food",
      date: new Date().toISOString(),
      paidByUserId: creator.id,
      splitType: "equal",
      memberIds: [creator.id],
      shares: [],
    });

    const updated = updateExpense(group.id, expense.id, creator.id, {
      title: "Lunch",
      amount: 35,
      currency: "RON",
      category: "food",
      date: new Date().toISOString(),
      paidByUserId: creator.id,
      splitType: "equal",
      memberIds: [creator.id],
      shares: [],
    });

    expect(updated?.amount).toBe(35);
    expect(deleteExpense(group.id, expense.id, creator.id)?.id).toBe(expense.id);
  });
});

