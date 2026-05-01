import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMemberToGroup,
  balanceSummaryForUser,
  buildEqualShares,
  createExpense,
  createGroup,
  createSettlement,
  deleteExpense,
  deleteGroup,
  emitEvent,
  findGroupById,
  getExpenseById,
  getGroupById,
  getUserById,
  getSeedUsers,
  getSettlementById,
  getState,
  getUserByIdentifier,
  getUserRecordById,
  leaveGroup,
  listExpenses,
  listGroupsForUserId,
  listSettlements,
  loginUser,
  nextId,
  nextSessionToken,
  normalizeShares,
  toUser,
  registerUser,
  resetSplitmatesStateForTests,
  resolveCurrentUser,
  resolveToken,
  roundMoney,
  sortExpenses,
  startGenerator,
  stopGenerator,
  subscribeToEvents,
  removeMemberFromGroup,
  updateExpense,
  updateGroup,
} from "@/lib/splitmates";
import { expenseSchema, generatorSchema, paginationSchema, settlementSchema } from "@/lib/splitmates/validation/schemas";

beforeEach(() => {
  resetSplitmatesStateForTests();
});

describe("splitmates core and services", () => {
  it("resolves auth sessions and request users", () => {
    expect(resolveToken(null)).toBeNull();
    expect(resolveToken("missing-token")).toBeNull();

    const login = loginUser({ identifier: "raluca", password: "raluca" });
    const byHeader = resolveCurrentUser(
      new Request("http://localhost/x", { headers: { authorization: `Bearer ${login.token}` } }),
    );
    expect(byHeader?.username).toBe("raluca");

    const fallback = resolveCurrentUser(new Request("http://localhost/x"), 2);
    expect(fallback?.username).toBe("ana");

    const byQuery = resolveCurrentUser(new Request("http://localhost/x?userId=3"));
    expect(byQuery?.username).toBe("elena");
  });

  it("exposes core id and user helpers", () => {
    const nextGroup = nextId("group");
    expect(nextGroup).toBeGreaterThan(0);
    expect(nextSessionToken()).toContain("session-");

    expect(getSeedUsers().length).toBeGreaterThan(0);
    expect(getUserById(1)?.username).toBe("raluca");
    expect(getUserByIdentifier("ana")?.email).toContain("@");
    expect(getUserRecordById(1)?.passwordHash).toBeTruthy();
    expect(getGroupById(1)?.name).toBeTruthy();
    expect(getExpenseById(1)?.id).toBe(1);
    expect(getSettlementById(999)).toBeNull();
    expect(toUser(null)).toBeNull();
  });

  it("validates math helpers and input schemas", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(buildEqualShares(100, []).length).toBe(0);
    expect(normalizeShares([{ userId: 1, amount: 10 }, { userId: 1, amount: 5 }])[0].amount).toBe(15);

    const sortedByAmount = sortExpenses(
      [
        { amount: 20, date: "2026-01-01" },
        { amount: 10, date: "2026-02-01" },
      ],
      "amount",
      "asc",
    );
    expect(sortedByAmount[0].amount).toBe(10);

    const sortedByDate = sortExpenses(
      [
        { amount: 20, date: "2026-02-01" },
        { amount: 10, date: "2026-01-01" },
      ],
      "date",
      "asc",
    );
    expect(sortedByDate[0].date).toContain("2026-01");

    const sortedByAmountDesc = sortExpenses(
      [
        { amount: 20, date: "2026-01-01" },
        { amount: 10, date: "2026-02-01" },
      ],
      "amount",
      "desc",
    );
    expect(sortedByAmountDesc[0].amount).toBe(20);

    const sortedByDateDesc = sortExpenses(
      [
        { amount: 20, date: "2026-02-01" },
        { amount: 10, date: "2026-01-01" },
      ],
      "date",
      "desc",
    );
    expect(sortedByDateDesc[0].date).toContain("2026-02");

    expect(() =>
      expenseSchema.parse({
        title: "Rent",
        amount: 100,
        currency: "RON",
        category: "rent",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "equal",
        memberIds: [],
        shares: [],
      }),
    ).toThrow("At least one member is required for equal split.");

    expect(() =>
      expenseSchema.parse({
        title: "Rent",
        amount: 100,
        currency: "RON",
        category: "rent",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "equal",
        memberIds: [1],
        shares: [{ userId: 1, amount: 100 }],
      }),
    ).toThrow("Equal split cannot include explicit shares.");

    expect(() =>
      expenseSchema.parse({
        title: "Dinner",
        amount: 100,
        currency: "RON",
        category: "food",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "custom",
        memberIds: [],
        shares: [],
      }),
    ).toThrow("Custom split requires shares.");

    expect(paginationSchema.parse({ pageSize: 5 }).page).toBe(1);
    expect(generatorSchema.parse({}).groupId).toBeUndefined();
    expect(() => settlementSchema.parse({ fromUserId: 1, toUserId: 1, amount: 1 })).toThrow();
  });

  it("supports group lifecycle rules", () => {
    expect(() => createGroup({ name: "Bad", category: "friends" }, 999)).toThrow("Creator user was not found.");

    expect(updateGroup(999, { name: "x" }, 1)).toBeNull();
    expect(deleteGroup(999, 1)).toBeNull();
    expect(() => addMemberToGroup(999, "ana", 1)).toThrow("Group not found.");

    const g = createGroup({ name: "Coverage Group", category: "friends" }, 1);
    expect(() => updateGroup(g.id, { name: "x" }, 2)).toThrow("Only a group admin can perform this action.");
    expect(() => addMemberToGroup(g.id, "nobody", 1)).toThrow("No profile exists for that email or username.");
    expect(() => leaveGroup(g.id, 2)).toThrow("User is not a member of this group.");

    addMemberToGroup(g.id, "ana", 1);
    expect(listGroupsForUserId(2).some((group) => group.id === g.id)).toBe(true);
    expect(deleteGroup(g.id, 1)?.id).toBe(g.id);

    const singleMemberGroup = createGroup({ name: "Solo", category: "friends" }, 1);
    expect(leaveGroup(singleMemberGroup.id, 1)?.id).toBe(singleMemberGroup.id);
    expect(getGroupById(singleMemberGroup.id)).toBeNull();

    const reassignmentGroup = createGroup({ name: "Reassign", category: "friends" }, 1);
    addMemberToGroup(reassignmentGroup.id, "ana", 1);
    const reassigned = removeMemberFromGroup(reassignmentGroup.id, 1, 1);
    expect(reassigned?.adminIds).toContain(2);

    expect(() => removeMemberFromGroup(reassignmentGroup.id, 9999, 1)).toThrow("Target user is not a member of this group.");

    const renamed = updateGroup(reassignmentGroup.id, { name: "Renamed" }, 2);
    expect(renamed?.description).toBeUndefined();
  });

  it("supports expenses and settlements", () => {
    const group = createGroup({ name: "Costs", category: "household" }, 1);
    addMemberToGroup(group.id, "ana", 1);

    expect(() =>
      createExpense(group.id, 1, {
        title: "Bad payer",
        amount: 100,
        currency: "RON",
        category: "other",
        date: new Date().toISOString(),
        paidByUserId: 3,
        splitType: "equal",
        memberIds: [1, 2],
        shares: [],
      }),
    ).toThrow("The payer must be a group member.");

    expect(() =>
      createExpense(group.id, 1, {
        title: "Bad custom",
        amount: 100,
        currency: "RON",
        category: "other",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "custom",
        memberIds: [],
        shares: [],
      }),
    ).toThrow("At least one member is required for the split.");

    const expense = createExpense(group.id, 1, {
      title: "Groceries",
      amount: 110,
      currency: "RON",
      category: "groceries",
      date: new Date().toISOString(),
      paidByUserId: 1,
      splitType: "equal",
      memberIds: [1, 2],
      shares: [],
    });

    expect(updateExpense(group.id, 999, 1, {
      title: "Nope",
      amount: 1,
      currency: "RON",
      category: "other",
      date: new Date().toISOString(),
      paidByUserId: 1,
      splitType: "equal",
      memberIds: [1],
      shares: [],
    })).toBeNull();

    expect(() =>
      createExpense(group.id, 3, {
        title: "No membership",
        amount: 100,
        currency: "RON",
        category: "other",
        date: new Date().toISOString(),
        paidByUserId: 3,
        splitType: "equal",
        memberIds: [3],
        shares: [],
      }),
    ).toThrow("User is not a member of this group.");

    expect(() =>
      updateExpense(group.id, expense.id, 2, {
        title: "No auth",
        amount: 120,
        currency: "RON",
        category: "groceries",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "equal",
        memberIds: [1, 2],
        shares: [],
      }),
    ).toThrow("Only the group admin or the payer can edit this expense.");

    expect(() => deleteExpense(group.id, expense.id, 2)).toThrow("Only the group admin or the payer can delete this expense.");
    expect(deleteExpense(group.id, 999, 1)).toBeNull();
    expect(listExpenses(group.id, 1, 5, "date", "desc", "food", 2).items).toHaveLength(0);

    expect(() => createSettlement(group.id, 1, { fromUserId: 1, toUserId: 3, amount: 10 })).toThrow(
      "Both settlement users must belong to the group.",
    );

    const fallbackExpense = createExpense(group.id, 1, {
      title: "Fallback",
      amount: 50,
      currency: "RON",
      category: "other",
      date: new Date().toISOString(),
      paidByUserId: 1,
      splitType: "equal",
      memberIds: [],
      shares: [],
    });
    expect(fallbackExpense.memberIds).toEqual([1, 2]);

    createSettlement(group.id, 1, { fromUserId: 2, toUserId: 1, amount: 15 });
    expect(listSettlements(group.id).length).toBeGreaterThan(0);
    expect(listExpenses(group.id, 999, 5, "date", "desc").page).toBeGreaterThan(0);
    expect(listExpenses(group.id, 1, 5, "amount", "asc", "groceries", 1).items.length).toBeGreaterThan(0);
    expect(getExpenseById(expense.id)?.groupId).toBe(group.id);
    expect(balanceSummaryForUser(1, group.id).totalSpent).toBeGreaterThan(0);
    expect(balanceSummaryForUser(999).net).toBe(0);
  });

  it("covers generator empty-group branches", () => {
    
    const creator = getUserByIdentifier("raluca")!;
    const emptyGroup = createGroup({ name: "Generator Group", category: "friends" }, creator.id);
    const state = getState();
    const storedGroup = state.groups.find((group) => group.id === emptyGroup.id);
    expect(storedGroup).toBeTruthy();

    if (storedGroup) {
      storedGroup.memberIds = [];
    }

    vi.useFakeTimers();
    startGenerator(emptyGroup.id);
    vi.advanceTimersByTime(2500);
    expect(getState().generator.generatedCount).toBe(0);
    stopGenerator();
    vi.useRealTimers();
  });

  it("publishes events and runs the generator", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToEvents(listener);
    emitEvent("test.event", { ok: true });
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    emitEvent("test.event", { ok: false });
    expect(listener).not.toHaveBeenCalled();

    expect(() => startGenerator(999)).toThrow("Group not found.");

    const group = findGroupById(1);
    expect(group).toBeTruthy();

    const state = getState();
    state.groups = [];
    vi.useFakeTimers();
    const started = startGenerator();
    expect(started.running).toBe(true);
    const alreadyRunning = startGenerator();
    expect(alreadyRunning.running).toBe(true);

    vi.advanceTimersByTime(2500);
    expect(getState().generator.generatedCount).toBe(0);

    const stopped = stopGenerator();
    expect(stopped.running).toBe(false);
    vi.useRealTimers();

    resetSplitmatesStateForTests();
    vi.useFakeTimers();
    startGenerator(1);
    vi.advanceTimersByTime(2500);
    expect(getState().generator.generatedCount).toBeGreaterThan(0);
    stopGenerator();
    vi.useRealTimers();

    const stoppedAgain = stopGenerator();
    expect(stoppedAgain.running).toBe(false);

    startGenerator();
    expect(getState().generator.running).toBe(true);
    resetSplitmatesStateForTests();
    expect(getState().generator.running).toBe(false);
  });

  it("handles auth success and failure paths", () => {
    expect(() => loginUser({ identifier: "raluca", password: "wrongpass" })).toThrow("Invalid login credentials.");
    expect(() => loginUser({ identifier: "nouser", password: "secret123" })).toThrow("Invalid login credentials.");

    const session = registerUser({ username: "newuser", email: "new@example.com", password: "secret123" });
    expect(session.user.username).toBe("newuser");
  });
});
