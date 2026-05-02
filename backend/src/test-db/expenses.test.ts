import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenses,
  createPayment,
  getPayments,
  getExpenseDetailForGroup,
} from "@/lib/splitmates/services/expenses-service";
import { createTestGroup, createTestUser, resetDatabase } from "./db-helpers";

beforeEach(async () => {
  await resetDatabase();
});

async function setupGroupWithMembers() {
  const alice = await createTestUser("alice", "alice@gmail.com");
  const bob = await createTestUser("bob", "bob@gmail.com");
  const charlie = await createTestUser("charlie", "charlie@gmail.com");
  const group = await createTestGroup(
    "Dormitory",
    alice.id,
    [alice.id, bob.id, charlie.id],
    [alice.id],
  );
  return { alice, bob, charlie, group };
}

describe("expenses CRUD", () => {
  it("createExpense persists the expense with participants", async () => {
    const { alice, bob, charlie, group } = await setupGroupWithMembers();

    const expense = await createExpense(group.id, alice.id, {
      title: "Rent",
      amount: 1500,
      currency: "RON",
      category: "rent",
      date: new Date().toISOString(),
      paidByUserId: alice.id,
      splitType: "equal",
      memberIds: [alice.id, bob.id, charlie.id],
      shares: [],
    });

    const inDb = await prisma.expense.findUnique({
      where: { id: expense.id },
      include: { participants: true },
    });
    expect(inDb!.title).toBe("Rent");
    expect(Number(inDb!.amount)).toBe(1500);
    expect(inDb!.participants).toHaveLength(3);

    const totalShares = inDb!.participants.reduce((sum, p) => sum + Number(p.amount), 0);
    expect(totalShares).toBeCloseTo(1500, 2);
  });

  it("updateExpense replaces participants", async () => {
    const { alice, bob, charlie, group } = await setupGroupWithMembers();
    const expense = await createExpense(group.id, alice.id, {
      title: "Rent",
      amount: 1500,
      currency: "RON",
      category: "rent",
      date: new Date().toISOString(),
      paidByUserId: alice.id,
      splitType: "equal",
      memberIds: [alice.id, bob.id, charlie.id],
      shares: [],
    });

    await updateExpense(group.id, expense.id, alice.id, {
      title: "Rent updated",
      amount: 900,
      currency: "RON",
      category: "rent",
      date: new Date().toISOString(),
      paidByUserId: alice.id,
      splitType: "equal",
      memberIds: [alice.id, bob.id],
      shares: [],
    });

    const updated = await prisma.expense.findUnique({
      where: { id: expense.id },
      include: { participants: true },
    });
    expect(updated!.title).toBe("Rent updated");
    expect(Number(updated!.amount)).toBe(900);
    expect(updated!.participants).toHaveLength(2);
  });

  it("deleteExpense removes the expense and its participants", async () => {
    const { alice, bob, charlie, group } = await setupGroupWithMembers();
    const expense = await createExpense(group.id, alice.id, {
      title: "Internet",
      amount: 90,
      currency: "RON",
      category: "utilities",
      date: new Date().toISOString(),
      paidByUserId: alice.id,
      splitType: "equal",
      memberIds: [alice.id, bob.id, charlie.id],
      shares: [],
    });

    await deleteExpense(group.id, expense.id, alice.id);

    const found = await prisma.expense.findUnique({ where: { id: expense.id } });
    expect(found).toBeNull();
  });
});

describe("expenses filters and pagination", () => {
  async function seedExpenses(groupId: number, alice: number, bob: number, charlie: number) {
    const date = new Date().toISOString();
    const memberIds = [alice, bob, charlie];
    await createExpense(groupId, alice, { title: "Rent", amount: 1500, currency: "RON", category: "rent", date, paidByUserId: alice, splitType: "equal", memberIds, shares: [] });
    await createExpense(groupId, alice, { title: "Bread", amount: 30, currency: "RON", category: "groceries", date, paidByUserId: bob, splitType: "equal", memberIds, shares: [] });
    await createExpense(groupId, alice, { title: "Bus", amount: 20, currency: "RON", category: "transport", date, paidByUserId: bob, splitType: "equal", memberIds, shares: [] });
    await createExpense(groupId, alice, { title: "Wine", amount: 60, currency: "RON", category: "groceries", date, paidByUserId: charlie, splitType: "equal", memberIds, shares: [] });
  }

  it("filters by category", async () => {
    const { alice, bob, charlie, group } = await setupGroupWithMembers();
    await seedExpenses(group.id, alice.id, bob.id, charlie.id);

    const result = await getExpenses(group.id, 1, 20, "date", "desc", "groceries");
    expect(result.totalItems).toBe(2);
    expect(result.items.every((item) => item.category === "groceries")).toBe(true);
  });

  it("filters by paidByUserId", async () => {
    const { alice, bob, charlie, group } = await setupGroupWithMembers();
    await seedExpenses(group.id, alice.id, bob.id, charlie.id);

    const result = await getExpenses(group.id, 1, 20, "date", "desc", undefined, bob.id);
    expect(result.totalItems).toBe(2);
    expect(result.items.every((item) => item.paidBy?.id === bob.id)).toBe(true);
  });

  it("paginates results with pageSize 2", async () => {
    const { alice, bob, charlie, group } = await setupGroupWithMembers();
    await seedExpenses(group.id, alice.id, bob.id, charlie.id);

    const page1 = await getExpenses(group.id, 1, 5, "amount", "desc");
    expect(page1.totalItems).toBe(4);
    expect(page1.items[0].title).toBe("Rent");

    const page2 = await getExpenses(group.id, 1, 5, "amount", "asc");
    expect(page2.items[0].title).toBe("Bus");
  });
});

describe("payments", () => {
  it("createPayment persists a payment", async () => {
    const { alice, bob, group } = await setupGroupWithMembers();

    const payment = await createPayment(group.id, alice.id, {
      fromUserId: bob.id,
      toUserId: alice.id,
      amount: 50,
    });

    const inDb = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(inDb).not.toBeNull();
    expect(Number(inDb!.amount)).toBe(50);
  });

  it("getPayments returns only payments for the given group", async () => {
    const { alice, bob, group } = await setupGroupWithMembers();
    await createPayment(group.id, alice.id, { fromUserId: bob.id, toUserId: alice.id, amount: 50 });
    await createPayment(group.id, alice.id, { fromUserId: bob.id, toUserId: alice.id, amount: 30 });

    const payments = await getPayments(group.id);
    expect(payments).toHaveLength(2);
  });

  it("createPayment throws if users are not in the group", async () => {
    const { alice, group } = await setupGroupWithMembers();
    const stranger = await createTestUser("stranger", "stranger@test.com");

    await expect(
      createPayment(group.id, alice.id, { fromUserId: alice.id, toUserId: stranger.id, amount: 50 })
    ).rejects.toThrow("Both payment users must belong to the group.");
  });
});

describe("expenses error handling and details", () => {
  const baseExpense = {
    title: "Test Expense",
    amount: 100,
    currency: "RON" as const,
    category: "other" as const,
    date: new Date().toISOString(),
  };

  it("createExpense rejects unauthorized or invalid participants", async () => {
    const { alice, group } = await setupGroupWithMembers();
    const stranger = await createTestUser("stranger", "stranger@test.com");

    await expect(
      createExpense(group.id, stranger.id, { ...baseExpense, paidByUserId: stranger.id, splitType: "equal", memberIds: [], shares: [] })
    ).rejects.toThrow("User is not a member of this group.");

    await expect(
      createExpense(group.id, alice.id, { ...baseExpense, paidByUserId: stranger.id, splitType: "equal", memberIds: [], shares: [] })
    ).rejects.toThrow("The payer must be a group member.");

    await expect(
      createExpense(group.id, alice.id, { ...baseExpense, paidByUserId: alice.id, splitType: "custom", memberIds: [], shares: [] })
    ).rejects.toThrow("At least one member is required for the split.");

    await expect(
      createExpense(group.id, alice.id, { ...baseExpense, paidByUserId: alice.id, splitType: "equal", memberIds: [alice.id, stranger.id], shares: [] })
    ).rejects.toThrow("All expense participants must be members of the group.");
  });

  it("updateExpense and deleteExpense enforce permissions and existence checks", async () => {
    const { alice, bob, charlie, group } = await setupGroupWithMembers();
    const expense = await createExpense(group.id, bob.id, {
      ...baseExpense, paidByUserId: bob.id, splitType: "equal", memberIds: [], shares: []
    });

    expect(await updateExpense(group.id, 99999, alice.id, { ...baseExpense, paidByUserId: alice.id, splitType: "equal", memberIds: [], shares: [] })).toBeNull();
    expect(await deleteExpense(group.id, 99999, alice.id)).toBeNull();

    await expect(
      updateExpense(group.id, expense.id, charlie.id, { ...baseExpense, paidByUserId: bob.id, splitType: "equal", memberIds: [], shares: [] })
    ).rejects.toThrow("Only the group admin or the payer can edit this expense.");

    await expect(
      deleteExpense(group.id, expense.id, charlie.id)
    ).rejects.toThrow("Only the group admin or the payer can delete this expense.");

    await expect(
      updateExpense(group.id, expense.id, bob.id, { ...baseExpense, paidByUserId: bob.id, splitType: "custom", memberIds: [], shares: [] })
    ).rejects.toThrow("At least one member is required for the split.");
  });

  it("getExpenseDetailForGroup correctly calculates detailed share percentages", async () => {
    const { alice, bob, group } = await setupGroupWithMembers();
    
    const expense = await createExpense(group.id, alice.id, {
      ...baseExpense,
      paidByUserId: alice.id,
      splitType: "custom",
      memberIds: [],
      shares: [{ userId: alice.id, amount: 60 }, { userId: bob.id, amount: 40 }]
    });

    const detail = await getExpenseDetailForGroup(group.id, expense.id, bob.id);
    
    expect(detail).not.toBeNull();
    expect(detail!.expense.amount).toBe(100);
    expect(detail!.payer.id).toBe(alice.id);
    expect(detail!.shares).toHaveLength(2);
    
    const bobShare = detail!.shares.find(s => s.userId === bob.id);
    expect(bobShare?.percent).toBe(40);
    expect(detail!.yourShare).toBe(40);

    expect(await getExpenseDetailForGroup(99999, expense.id)).toBeNull();
    expect(await getExpenseDetailForGroup(group.id, 99999)).toBeNull();
  });
});

describe("expenses edge cases", () => {
  const baseExpense = {
    title: "Test",
    amount: 100,
    currency: "RON" as const,
    category: "other" as const,
    date: new Date().toISOString(),
  };

  it("throws when group is missing during initial check", async () => {
    await expect(
      deleteExpense(999999, 1, 1)
    ).rejects.toThrow("Group not found.");
  });

  it("throws if group vanishes during participant check", async () => {
    const { alice, group } = await setupGroupWithMembers();
    
    const originalFindUnique = prisma.group.findUnique;
    let calls = 0;
    
    vi.spyOn(prisma.group, "findUnique").mockImplementation((async (args: any) => {
      calls++;
      if (calls === 2) return null;
      return originalFindUnique(args);
    }) as any);

    await expect(
      createExpense(group.id, alice.id, { 
        ...baseExpense, 
        paidByUserId: alice.id, 
        splitType: "equal", 
        memberIds: [alice.id], 
        shares: [] 
      })
    ).rejects.toThrow("Group not found.");

    vi.restoreAllMocks();
  });

  it("returns null for cross-group ID mismatch during update", async () => {
    const { alice, group: groupA } = await setupGroupWithMembers();
    const groupB = await createTestGroup("Another Group", alice.id, [alice.id], [alice.id]);

    const expenseA = await createExpense(groupA.id, alice.id, { 
      ...baseExpense, paidByUserId: alice.id, splitType: "equal", memberIds: [], shares: [] 
    });

    const result = await updateExpense(groupB.id, expenseA.id, alice.id, {
      ...baseExpense, paidByUserId: alice.id, splitType: "equal", memberIds: [], shares: [] 
    });

    expect(result).toBeNull();
  });
});