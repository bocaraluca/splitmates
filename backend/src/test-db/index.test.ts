import { describe, it, expect, beforeEach } from "vitest";
import {
  getUsers,
  getUserById,
  getUserByIdentifier,
  getUserRecordByIdentifier,
  getUserRecordById,
  getGroupById,
  getExpenseById,
  getPaymentById,
  getSeedUsers
} from "@/lib/splitmates/index";
import { createTestGroup, createTestUser, resetDatabase } from "./db-helpers";
import { createExpense, createPayment } from "@/lib/splitmates/services/expenses-service";

beforeEach(async () => {
  await resetDatabase();
});

describe("splitmates/index.ts wrappers", () => {
  it("covers user fetching functions and toUser mapping", async () => {
    const user1 = await createTestUser("alpha", "alpha@test.com");
    const user2 = await createTestUser("beta", "beta@test.com");

    const allUsers = await getUsers();
    expect(allUsers.length).toBeGreaterThanOrEqual(2);
    
    const mappedUser1 = allUsers.find(u => u.username === "alpha");
    expect(mappedUser1).toBeDefined();
    expect(typeof mappedUser1!.createdAt).toBe("string");
    
    const seedUsers = await getSeedUsers();
    expect(seedUsers.length).toEqual(allUsers.length);

    const foundById = await getUserById(user1.id);
    expect(foundById?.username).toBe("alpha");
    expect(await getUserById(99999)).toBeNull();

    expect((await getUserByIdentifier("ALPHA "))?.email).toBe("alpha@test.com");
    expect((await getUserByIdentifier("beta@TEST.com"))?.username).toBe("beta");
    expect(await getUserByIdentifier("ghost")).toBeNull();

    const recordByIdent = await getUserRecordByIdentifier("alpha");
    expect(recordByIdent?.passwordHash).toBeDefined();
    expect(await getUserRecordByIdentifier("ghost")).toBeNull();

    const recordById = await getUserRecordById(user2.id);
    expect(recordById?.username).toBe("beta");
    expect(await getUserRecordById(99999)).toBeNull();
  });

  it("covers group fetching", async () => {
    const alice = await createTestUser("alice", "alice@test.com");
    const bob = await createTestUser("bob", "bob@test.com");
    const group = await createTestGroup("Test Group", alice.id, [alice.id, bob.id], [alice.id]);

    const foundGroup = await getGroupById(group.id);
    expect(foundGroup).not.toBeNull();
    expect(foundGroup!.name).toBe("Test Group");
    expect(foundGroup!.memberIds).toHaveLength(2);
    expect(foundGroup!.adminIds).toEqual([alice.id]);

    expect(await getGroupById(99999)).toBeNull();
  });

  it("covers expense fetching", async () => {
    const alice = await createTestUser("alice", "alice@test.com");
    const bob = await createTestUser("bob", "bob@test.com");
    const group = await createTestGroup("Test Group", alice.id, [alice.id, bob.id], [alice.id]);

    const expense = await createExpense(group.id, alice.id, {
      title: "Food",
      amount: 100,
      currency: "RON",
      category: "food",
      date: new Date().toISOString(),
      paidByUserId: alice.id,
      splitType: "equal",
      memberIds: [alice.id, bob.id],
      shares: []
    });

    const foundExpense = await getExpenseById(expense.id);
    expect(foundExpense).not.toBeNull();
    expect(foundExpense!.title).toBe("Food");
    expect(foundExpense!.participants).toHaveLength(2);

    expect(await getExpenseById(99999)).toBeNull();
  });

  it("covers payment fetching", async () => {
    const alice = await createTestUser("alice", "alice@test.com");
    const bob = await createTestUser("bob", "bob@test.com");
    const group = await createTestGroup("Test Group", alice.id, [alice.id, bob.id], [alice.id]);

    const payment = await createPayment(group.id, alice.id, {
      fromUserId: bob.id,
      toUserId: alice.id,
      amount: 50
    });

    const foundPayment = await getPaymentById(payment.id);
    expect(foundPayment).not.toBeNull();
    expect(Number(foundPayment!.amount)).toBe(50);

    expect(await getPaymentById(99999)).toBeNull();
  });
});