import { buildSchema, graphql } from "graphql";
import { mapGroupForResponse } from "@/lib/splitmates/api/group-response";
import {
  addMemberToGroup,
  createExpense,
  createGroup,
  createSettlement,
  deleteExpense,
  deleteGroup,
  getDashboardSummary,
  getExpenseDetailForGroup,
  getGeneratorStatus,
  getGroupById,
  getGroupStats,
  getUserById,
  getUsers,
  leaveGroup,
  listExpenses,
  listGroups,
  listSettlements,
  loginUser,
  removeMemberFromGroup,
  signupUser,
  resolveCurrentUser,
  startGenerator,
  stopGenerator,
  updateExpense,
  updateGroup,
} from "@/lib/splitmates";
import { addGroupMemberSchema, createGroupSchema, expenseSchema, paginationSchema, settlementSchema, signupSchema } from "@/lib/splitmates/validation/schemas";

export const runtime = "nodejs";

const schema = buildSchema(`
  type User {
    id: Int!
    username: String!
    email: String!
  }

  type Share {
    userId: Int!
    amount: Float!
  }

  type Expense {
    id: Int!
    groupId: Int!
    title: String!
    amount: Float!
    currency: String!
    category: String!
    date: String!
    paidByUserId: Int!
    splitType: String!
    memberIds: [Int!]!
    shares: [Share!]!
    paidBy: User
  }

  type ExpenseListItem {
    id: Int!
    title: String!
    amount: Float!
    currency: String!
    category: String!
    date: String!
    splitType: String!
    paidBy: User
  }

  type ExpenseList {
    items: [ExpenseListItem!]!
    page: Int!
    pageSize: Int!
    totalItems: Int!
    totalPages: Int!
  }

  type Group {
    id: Int!
    name: String!
    description: String
    category: String!
    memberIds: [Int!]!
    adminIds: [Int!]!
    members: [User]
    admins: [User]
    isMember: Boolean!
    isAdmin: Boolean!
  }

  type CategoryStat {
    category: String!
    amount: Float!
    percentage: Float!
  }

  type MonthStat {
    month: String!
    amount: Float!
  }

  type BalanceEdge {
    userId: Int!
    username: String!
    amount: Float!
  }

  type GroupBalanceSummary {
    net: Float!
    youOweTo: [BalanceEdge!]!
    othersOweToYou: [BalanceEdge!]!
  }

  type GroupStats {
    groupId: Int!
    totalSpent: Float!
    mostExpensiveCategory: String!
    topCategoryAmount: Float!
    categories: [CategoryStat!]!
    months: [MonthStat!]!
    balance: GroupBalanceSummary!
  }

  type Settlement {
    id: Int!
    groupId: Int!
    fromUserId: Int!
    toUserId: Int!
    amount: Float!
    date: String!
    note: String
  }

  type GeneratorStatus {
    running: Boolean!
    intervalMs: Int!
    generatedCount: Int!
    groupId: Int
  }

  type DashboardSummary {
    userId: Int!
    overall: String!
  }

  type AuthSession {
    token: String!
    user: User!
  }

  type GroupPayload {
    group: Group!
  }

  type ExpensePayload {
    expense: Expense!
  }

  type SettlementPayload {
    settlement: Settlement!
  }

  type GeneratorPayload {
    status: GeneratorStatus!
  }

  input GroupInput {
    name: String!
    description: String
    category: String!
  }

  input GroupPatchInput {
    name: String
    description: String
    category: String
  }

  input PaginationInput {
    page: Int
    pageSize: Int
    category: String
    paidByUserId: Int
    sortBy: String
    sortOrder: String
  }

  input ShareInput {
    userId: Int!
    amount: Float!
  }

  input ExpenseInput {
    title: String!
    amount: Float!
    currency: String!
    category: String!
    date: String!
    paidByUserId: Int!
    splitType: String!
    memberIds: [Int!]!
    shares: [ShareInput!]!
  }

  input SettlementInput {
    fromUserId: Int!
    toUserId: Int!
    amount: Float!
    date: String
    note: String
  }

  type Query {
    me: User
    groups: [Group!]!
    group(groupId: Int!): Group
    expenses(groupId: Int!, pagination: PaginationInput): ExpenseList!
    expense(groupId: Int!, expenseId: Int!): Expense
    groupStats(groupId: Int!): GroupStats
    settlements(groupId: Int!): [Settlement!]!
    generatorStatus: GeneratorStatus!
    dashboard: DashboardSummary
  }

  type Mutation {
    signup(username: String!, email: String!, password: String!, confirmPassword: String!): AuthSession!
    login(identifier: String!, password: String!): AuthSession!

    createGroup(input: GroupInput!): GroupPayload!
    updateGroup(groupId: Int!, input: GroupPatchInput!): GroupPayload!
    deleteGroup(groupId: Int!): GroupPayload!

    addMember(groupId: Int!, identifier: String!): GroupPayload!
    removeMember(groupId: Int!, userId: Int!): GroupPayload!
    leaveGroup(groupId: Int!): GroupPayload!

    createExpense(groupId: Int!, input: ExpenseInput!): ExpensePayload!
    updateExpense(groupId: Int!, expenseId: Int!, input: ExpenseInput!): ExpensePayload!
    deleteExpense(groupId: Int!, expenseId: Int!): ExpensePayload!

    createSettlement(groupId: Int!, input: SettlementInput!): SettlementPayload!

    startGenerator(groupId: Int): GeneratorPayload!
    stopGenerator: GeneratorPayload!
  }
`);

type GraphqlRequest = {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
};

function mapGroup(groupId: number, request: Request) {
  const group = getGroupById(groupId);
  if (!group) {
    return null;
  }

  const currentUser = resolveCurrentUser(request);
  return mapGroupForResponse(group, currentUser?.id ?? -1);
}

function mapExpense(expense: {
  id: number;
  groupId: number;
  title: string;
  amount: number;
  currency: "RON";
  category: string;
  date: string;
  paidByUserId: number;
  splitType: "equal" | "custom";
  memberIds: number[];
  shares: Array<{ userId: number; amount: number }>;
}) {
  return {
    ...expense,
    paidBy: getUserById(expense.paidByUserId),
  };
}

function requireCurrentUser(request: Request) {
  const actor = resolveCurrentUser(request);
  if (!actor) {
    throw new Error("You must be logged in.");
  }

  return actor;
}

function parseExpenseInput(input: Record<string, unknown>) {
  const parsed = expenseSchema.parse({
    title: input.title,
    amount: input.amount,
    currency: input.currency,
    category: input.category,
    date: input.date,
    paidByUserId: input.paidByUserId,
    splitType: input.splitType,
    memberIds: Array.isArray(input.memberIds) ? input.memberIds : [],
    shares: Array.isArray(input.shares) ? input.shares : [],
  });

  return parsed;
}

function rootValue(request: Request) {
  return {
    me: () => resolveCurrentUser(request),

    groups: () => listGroups().map((group) => mapGroup(group.id, request)),

    group: ({ groupId }: { groupId: number }) => mapGroup(groupId, request),

    expenses: ({ groupId, pagination }: { groupId: number; pagination?: Record<string, unknown> }) => {
      const parsed = paginationSchema.parse(pagination ?? {});
      const result = listExpenses(groupId, parsed.page, parsed.pageSize, parsed.sortBy, parsed.sortOrder, parsed.category, parsed.paidByUserId);
      return result;
    },

    expense: ({ groupId, expenseId }: { groupId: number; expenseId: number }) => {
      const detail = getExpenseDetailForGroup(groupId, expenseId, resolveCurrentUser(request)?.id);
      if (!detail) {
        return null;
      }

      return mapExpense(detail.expense);
    },

    groupStats: ({ groupId }: { groupId: number }) => {
      const stats = getGroupStats(groupId);
      if (!stats) {
        return null;
      }

      return {
        groupId: stats.group.id,
        totalSpent: stats.totalSpent,
        mostExpensiveCategory: stats.mostExpensiveCategory ?? "other",
        topCategoryAmount: stats.topCategoryAmount,
        categories: stats.categories,
        months: stats.months,
        balance: {
          net: stats.balance.net,
          youOweTo: stats.balance.youOweTo,
          othersOweToYou: stats.balance.othersOweToYou,
        },
      };
    },

    settlements: ({ groupId }: { groupId: number }) => listSettlements(groupId),

    generatorStatus: () => getGeneratorStatus(),

    dashboard: () => {
      const currentUser = resolveCurrentUser(request) ?? getUsers()[0] ?? null;
      if (!currentUser) {
        return null;
      }

      const summary = getDashboardSummary(currentUser.id);
      return {
        userId: currentUser.id,
        overall: JSON.stringify(summary.overall),
      };
    },

    signup: ({ username, email, password, confirmPassword }: { username: string; email: string; password: string; confirmPassword: string }) => {
      const parsed = signupSchema.parse({ username, email, password, confirmPassword });
      return signupUser({ username: parsed.username, email: parsed.email, password: parsed.password });
    },

    login: ({ identifier, password }: { identifier: string; password: string }) => loginUser({ identifier, password }),

    createGroup: ({ input }: { input: Record<string, unknown> }) => {
      const actor = requireCurrentUser(request);
      const parsed = createGroupSchema.parse(input);
      const group = createGroup(parsed, actor.id);
      return { group: mapGroup(group.id, request) };
    },

    updateGroup: ({ groupId, input }: { groupId: number; input: Record<string, unknown> }) => {
      const actor = requireCurrentUser(request);
      const parsed = createGroupSchema.partial().parse(input);
      const group = updateGroup(groupId, parsed, actor.id);
      if (!group) {
        throw new Error("Group not found.");
      }
      return { group: mapGroup(group.id, request) };
    },

    deleteGroup: ({ groupId }: { groupId: number }) => {
      const actor = requireCurrentUser(request);
      const group = deleteGroup(groupId, actor.id);
      if (!group) {
        throw new Error("Group not found.");
      }
      return { group: { ...group, members: [], admins: [], isMember: false, isAdmin: false } };
    },

    addMember: ({ groupId, identifier }: { groupId: number; identifier: string }) => {
      const actor = requireCurrentUser(request);
      const parsed = addGroupMemberSchema.parse({ identifier });
      const group = addMemberToGroup(groupId, parsed.identifier, actor.id);
      return { group: mapGroup(group.id, request) };
    },

    removeMember: ({ groupId, userId }: { groupId: number; userId: number }) => {
      const actor = requireCurrentUser(request);
      const group = removeMemberFromGroup(groupId, userId, actor.id);
      return {
        group: mapGroup(group.id, request) ?? { ...group, members: [], admins: [], isMember: false, isAdmin: false },
      };
    },

    leaveGroup: ({ groupId }: { groupId: number }) => {
      const actor = requireCurrentUser(request);
      const group = leaveGroup(groupId, actor.id);
      return {
        group: mapGroup(group.id, request) ?? { ...group, members: [], admins: [], isMember: false, isAdmin: false },
      };
    },

    createExpense: ({ groupId, input }: { groupId: number; input: Record<string, unknown> }) => {
      const actor = requireCurrentUser(request);
      const parsed = parseExpenseInput(input);
      const expense = createExpense(groupId, actor.id, parsed);
      return { expense: mapExpense(expense) };
    },

    updateExpense: ({ groupId, expenseId, input }: { groupId: number; expenseId: number; input: Record<string, unknown> }) => {
      const actor = requireCurrentUser(request);
      const parsed = parseExpenseInput(input);
      const expense = updateExpense(groupId, expenseId, actor.id, parsed);
      if (!expense) {
        throw new Error("Expense not found.");
      }
      return { expense: mapExpense(expense) };
    },

    deleteExpense: ({ groupId, expenseId }: { groupId: number; expenseId: number }) => {
      const actor = requireCurrentUser(request);
      const expense = deleteExpense(groupId, expenseId, actor.id);
      if (!expense) {
        throw new Error("Expense not found.");
      }
      return { expense: mapExpense(expense) };
    },

    createSettlement: ({ groupId, input }: { groupId: number; input: Record<string, unknown> }) => {
      const actor = requireCurrentUser(request);
      const parsed = settlementSchema.parse(input);
      const settlement = createSettlement(groupId, actor.id, parsed);
      return { settlement };
    },

    startGenerator: ({ groupId }: { groupId?: number }) => ({ status: startGenerator(groupId ?? null) }),

    stopGenerator: () => ({ status: stopGenerator() }),
  };
}

export async function GET() {
  return Response.json({ ok: true, graphql: "/api/graphql" });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GraphqlRequest;
    if (!body?.query) {
      return Response.json({ errors: [{ message: "Missing GraphQL query." }] }, { status: 400 });
    }

    const result = await graphql({
      schema,
      source: body.query,
      variableValues: body.variables,
      operationName: body.operationName,
      rootValue: rootValue(request),
    });

    const status = result.errors?.length ? 400 : 200;
    return Response.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GraphQL request failed.";
    return Response.json({ errors: [{ message }] }, { status: 400 });
  }
}
