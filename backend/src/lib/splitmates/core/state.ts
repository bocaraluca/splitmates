import bcrypt from "bcryptjs";
import { EventEmitter } from "node:events";
import type { Id, Expense, GroupRecord, Settlement, UserRecord } from "../model/types";
import { buildEqualShares } from "./math";

interface IdCounters {
  user: number;
  group: number;
  expense: number;
  settlement: number;
  session: number;
}

export interface SplitmatesState {
  users: UserRecord[];
  groups: GroupRecord[];
  expenses: Expense[];
  settlements: Settlement[];
  sessions: Map<string, Id>;
  revokedSessionTokens: Set<string>;
  counters: IdCounters;
  emitter: EventEmitter;
  generator: {
    timer: NodeJS.Timeout | null;
    running: boolean;
    generatedCount: number;
    groupId: Id | null;
  };
}

const globalScope = globalThis as typeof globalThis & {
  __splitmatesState?: SplitmatesState;
};

function createInitialState(): SplitmatesState {
  const passwordHash = bcrypt.hashSync("raluca", 10);
  const createdAt = new Date().toISOString();

  const users: UserRecord[] = [
    { id: 1, username: "raluca", email: "raluca@gmail.com", passwordHash, createdAt },
    { id: 2, username: "ana", email: "ana@gmail.com", passwordHash, createdAt },
    { id: 3, username: "elena", email: "elena@gmail.com", passwordHash, createdAt },
  ];

  const groups: GroupRecord[] = [
    {
      id: 1,
      name: "Apartment",
      category: "household",
      createdAt,
      updatedAt: createdAt,
      memberIds: [1, 2, 3],
      adminIds: [1],
    },
    {
      id: 2,
      name: "Weekend Trip",
      category: "trip",
      createdAt,
      updatedAt: createdAt,
      memberIds: [1, 2],
      adminIds: [2],
    },
  ];

  const now = new Date().toISOString();
  const expenses: Expense[] = [
    {
      id: 1,
      groupId: 1,
      title: "Rent",
      amount: 1800,
      currency: "RON",
      category: "rent",
      date: now,
      paidByUserId: 1,
      splitType: "equal",
      memberIds: [1, 2, 3],
      shares: buildEqualShares(1800, [1, 2, 3]),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      groupId: 1,
      title: "Groceries",
      amount: 420,
      currency: "RON",
      category: "groceries",
      date: now,
      paidByUserId: 2,
      splitType: "equal",
      memberIds: [1, 2, 3],
      shares: buildEqualShares(420, [1, 2, 3]),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      groupId: 1,
      title: "Utilities",
      amount: 255,
      currency: "RON",
      category: "utilities",
      date: now,
      paidByUserId: 3,
      splitType: "equal",
      memberIds: [1, 2, 3],
      shares: buildEqualShares(255, [1, 2, 3]),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 4,
      groupId: 2,
      title: "Train tickets",
      amount: 160,
      currency: "RON",
      category: "transport",
      date: now,
      paidByUserId: 2,
      splitType: "equal",
      memberIds: [1, 2],
      shares: buildEqualShares(160, [1, 2]),
      createdAt: now,
      updatedAt: now,
    },
  ];

  const settlements: Settlement[] = [
    {
      id: 1,
      groupId: 1,
      fromUserId: 3,
      toUserId: 1,
      amount: 50,
      date: now,
      note: "Partial repayment",
      createdAt: now,
    },
  ];

  return {
    users,
    groups,
    expenses,
    settlements,
    sessions: new Map<string, Id>(),
    revokedSessionTokens: new Set<string>(),
    counters: {
      user: 4,
      group: 3,
      expense: 5,
      settlement: 2,
      session: 1,
    },
    emitter: new EventEmitter(),
    generator: {
      timer: null,
      running: false,
      generatedCount: 0,
      groupId: 1,
    },
  };
}

export function getState(): SplitmatesState {
  if (!globalScope.__splitmatesState) {
    globalScope.__splitmatesState = createInitialState();
  }

  return globalScope.__splitmatesState;
}

export function nextId(type: keyof Pick<IdCounters, "user" | "group" | "expense" | "settlement">): Id {
  const state = getState();
  const id = state.counters[type];
  state.counters[type] += 1;
  return id;
}

export function nextSessionToken(): string {
  const state = getState();
  const token = `session-${state.counters.session}`;
  state.counters.session += 1;
  return token;
}

export function resetSplitmatesStateForTests() {
  if (globalScope.__splitmatesState?.generator.timer) {
    clearInterval(globalScope.__splitmatesState.generator.timer);
  }

  delete globalScope.__splitmatesState;
}

export function toUser(user: UserRecord | undefined | null) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export function findUserByIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  const state = getState();

  return (
    state.users.find((user) => user.username.toLowerCase() === normalized) ||
    state.users.find((user) => user.email.toLowerCase() === normalized) ||
    null
  );
}

export function findUserById(userId: Id) {
  return getState().users.find((user) => user.id === userId) ?? null;
}

export function findGroupById(groupId: Id) {
  return getState().groups.find((group) => group.id === groupId) ?? null;
}

export function findExpenseById(expenseId: Id) {
  return getState().expenses.find((expense) => expense.id === expenseId) ?? null;
}

export function findSettlementById(settlementId: Id) {
  return getState().settlements.find((settlement) => settlement.id === settlementId) ?? null;
}

export function getUsers() {
  return getState().users.map((user) => toUser(user)!);
}

