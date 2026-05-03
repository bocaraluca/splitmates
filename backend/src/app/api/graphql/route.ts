import { buildSchema, graphql } from "graphql";
import { mapGroupForResponse } from "@/lib/splitmates/api/group-response";
import {
  addMemberToGroup,
  createExpense,
  createGroup,
  createPayment,
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
  getExpenses,
  getGroups,
  getPayments,
  loginUser,
  removeMemberFromGroup,
  signupUser,
  getCurrentUserFromRequest,
  startGenerator,
  stopGenerator,
  updateExpense,
  updateGroup,
} from "@/lib/splitmates";
import { addGroupMemberSchema, createGroupSchema, expenseSchema, paginationSchema, paymentSchema, signupSchema } from "@/lib/splitmates/validation/schemas";

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

  type Payment {
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
    role: String!
    permissions: [String!]!
  }

  type GroupPayload {
    group: Group!
  }

  type ExpensePayload {
    expense: Expense!
  }

  type PaymentPayload {
    Payment: Payment!
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

  input PaymentInput {
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
    payments(groupId: Int!): [Payment!]!
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

    createPayment(groupId: Int!, input: PaymentInput!): PaymentPayload!

    startGenerator(groupId: Int): GeneratorPayload!
    stopGenerator: GeneratorPayload!
  }
`);

type GraphqlRequest = {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
};

async function mapGroup(groupId: number, request: Request) {
  const group = await getGroupById(groupId);
  if (!group) {
    return null;
  }

  const currentUser = await getCurrentUserFromRequest(request);
  return mapGroupForResponse(group, currentUser?.id ?? -1);
}

async function mapExpense(expense: any) {
  const memberIds: number[] = expense.memberIds ?? (expense.participants ? expense.participants.map((p: any) => p.userId) : []);
  const shares: Array<{ userId: number; amount: number }> =
    expense.shares ?? (expense.participants ? expense.participants.map((p: any) => ({ userId: p.userId, amount: Number(p.amount) })) : []);

  const paidByUserId = expense.paidByUserId ?? expense.paidBy?.id ?? expense.paidByUser?.id ?? null;
  const paidBy = expense.paidBy ?? (paidByUserId ? await getUserById(paidByUserId) : null);

  return {
    id: expense.id,
    groupId: expense.groupId,
    title: expense.title,
    amount: Number(expense.amount),
    currency: expense.currency ?? "RON",
    category: expense.category,
    date: typeof expense.date === "string" ? expense.date : expense.date?.toISOString?.(),
    paidByUserId,
    splitType: expense.splitType,
    memberIds,
    shares,
    paidBy,
  };
}

async function requireCurrentUser(request: Request) {
  const actor = await getCurrentUserFromRequest(request);
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
    me: async () => await getCurrentUserFromRequest(request),

    groups: async () => {
      const groups = await getGroups();
      return await Promise.all(groups.map((group) => mapGroup(group.id, request)));
    },

    group: ({ groupId }: { groupId: number }) => mapGroup(groupId, request),

    expenses: async ({ groupId, pagination }: { groupId: number; pagination?: Record<string, unknown> }) => {
      const parsed = paginationSchema.parse(pagination ?? {});
      const result = await getExpenses(groupId, parsed.page, parsed.pageSize, parsed.sortBy, parsed.sortOrder, parsed.category, parsed.paidByUserId);
      return result;
    },

    expense: async ({ groupId, expenseId }: { groupId: number; expenseId: number }) => {
      const currentUser = await getCurrentUserFromRequest(request);
      const detail = await getExpenseDetailForGroup(groupId, expenseId, currentUser?.id);
      if (!detail) {
        return null;
      }

      return await mapExpense(detail.expense);
    },

    groupStats: async ({ groupId }: { groupId: number }) => {
      const stats = await getGroupStats(groupId);
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

    payments: async ({ groupId }: { groupId: number }) => await getPayments(groupId),

    generatorStatus: () => getGeneratorStatus(),

    dashboard: async () => {
      const currentUser = (await getCurrentUserFromRequest(request)) ?? (await getUsers())[0] ?? null;
      if (!currentUser) {
        return null;
      }

      const summary = await getDashboardSummary(currentUser.id);
      return {
        userId: currentUser.id,
        overall: JSON.stringify(summary.overall),
      };
    },

    signup: async ({ username, email, password, confirmPassword }: { username: string; email: string; password: string; confirmPassword: string }) => {
      const parsed = signupSchema.parse({ username, email, password, confirmPassword });
      return await signupUser({ username: parsed.username, email: parsed.email, password: parsed.password });
    },

    login: async ({ identifier, password }: { identifier: string; password: string }) => await loginUser({ identifier, password }),

    createGroup: async ({ input }: { input: Record<string, unknown> }) => {
      const actor = await requireCurrentUser(request);
      const parsed = createGroupSchema.parse(input);
      const group = await createGroup(parsed, actor.id);
      return { group: await mapGroup(group.id, request) };
    },

    updateGroup: async ({ groupId, input }: { groupId: number; input: Record<string, unknown> }) => {
      const actor = await requireCurrentUser(request);
      const parsed = createGroupSchema.partial().parse(input);
      const group = await updateGroup(groupId, parsed, actor.id);
      if (!group) {
        throw new Error("Group not found.");
      }
      return { group: await mapGroup(group.id, request) };
    },

    deleteGroup: async ({ groupId }: { groupId: number }) => {
      const actor = await requireCurrentUser(request);
      const group = await deleteGroup(groupId, actor.id);
      if (!group) {
        throw new Error("Group not found.");
      }
      return { group: { ...group, members: [], admins: [], isMember: false, isAdmin: false } };
    },

    addMember: async ({ groupId, identifier }: { groupId: number; identifier: string }) => {
      const actor = await requireCurrentUser(request);
      const parsed = addGroupMemberSchema.parse({ identifier });
      const group = await addMemberToGroup(groupId, parsed.identifier, actor.id);
      return { group: await mapGroup(group.id, request) };
    },

    removeMember: async ({ groupId, userId }: { groupId: number; userId: number }) => {
      const actor = await requireCurrentUser(request);
      const group = await removeMemberFromGroup(groupId, userId, actor.id);
      return {
        group: (await mapGroup(group.id, request)) ?? { ...group, members: [], admins: [], isMember: false, isAdmin: false },
      };
    },

    leaveGroup: async ({ groupId }: { groupId: number }) => {
      const actor = await requireCurrentUser(request);
      const group = await leaveGroup(groupId, actor.id);
      return {
        group: (await mapGroup(group.id, request)) ?? { ...group, members: [], admins: [], isMember: false, isAdmin: false },
      };
    },

    createExpense: async ({ groupId, input }: { groupId: number; input: Record<string, unknown> }) => {
      const actor = await requireCurrentUser(request);
      const parsed = parseExpenseInput(input);
      const expense = await createExpense(groupId, actor.id, parsed);
      return { expense: await mapExpense(expense) };
    },

    updateExpense: async ({ groupId, expenseId, input }: { groupId: number; expenseId: number; input: Record<string, unknown> }) => {
      const actor = await requireCurrentUser(request);
      const parsed = parseExpenseInput(input);
      const expense = await updateExpense(groupId, expenseId, actor.id, parsed);
      if (!expense) {
        throw new Error("Expense not found.");
      }
      return { expense: await mapExpense(expense) };
    },

    deleteExpense: async ({ groupId, expenseId }: { groupId: number; expenseId: number }) => {
      const actor = await requireCurrentUser(request);
      const expense = await deleteExpense(groupId, expenseId, actor.id);
      if (!expense) {
        throw new Error("Expense not found.");
      }
      return { expense: await mapExpense(expense) };
    },

    createPayment: async ({ groupId, input }: { groupId: number; input: Record<string, unknown> }) => {
      const actor = await requireCurrentUser(request);
      const parsed = paymentSchema.parse(input);
      const payment = await createPayment(groupId, actor.id, parsed);
      return { Payment: payment };
    },

    startGenerator: async ({ groupId }: { groupId?: number }) => ({
      status: await startGenerator(groupId ?? null),
    }),

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

    const status = result.errors?.length
      ? result.errors.some((error) => (error.originalError as { status?: number } | undefined)?.status === 403)
        ? 403
        : 400
      : 200;
    return Response.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GraphQL request failed.";
    const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 400;
    return Response.json({ errors: [{ message }] }, { status });
  }
}

