import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/graphql/route";

const deps = vi.hoisted(() => ({
  addMemberToGroup: vi.fn(),
  createExpense: vi.fn(),
  createGroup: vi.fn(),
  createPayment: vi.fn(),
  deleteExpense: vi.fn(),
  deleteGroup: vi.fn(),
  getDashboardSummary: vi.fn(),
  getExpenseDetailForGroup: vi.fn(),
  getGeneratorStatus: vi.fn(),
  getGroupById: vi.fn(),
  getGroupStats: vi.fn(),
  getUserById: vi.fn(),
  getUsers: vi.fn(),
  leaveGroup: vi.fn(),
  getExpenses: vi.fn(),
  getGroups: vi.fn(),
  getPayments: vi.fn(),
  loginUser: vi.fn(),
  removeMemberFromGroup: vi.fn(),
  signupUser: vi.fn(),
  getCurrentUserFromRequest: vi.fn(),
  startGenerator: vi.fn(),
  stopGenerator: vi.fn(),
  updateExpense: vi.fn(),
  updateGroup: vi.fn(),
}));

vi.mock("@/lib/splitmates", () => deps);
vi.mock("@/lib/splitmates/api/group-response", () => ({
  mapGroupForResponse: vi.fn().mockReturnValue({
    id: 1,
    name: "Test Group",
    category: "other",
    memberIds: [],
    adminIds: [],
    isMember: true,
    isAdmin: true,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GraphQL Route", () => {
  it("GET returns connection info", async () => {
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("POST handles malformed json and missing query", async () => {
    const badJsonReq = new Request("http://localhost", { method: "POST", body: "{" });
    const badJsonRes = await POST(badJsonReq);
    expect(badJsonRes.status).toBe(400);

    const missingQueryReq = new Request("http://localhost", { method: "POST", body: JSON.stringify({}) });
    const missingQueryRes = await POST(missingQueryReq);
    expect(missingQueryRes.status).toBe(400);
  });

  it("POST executes success queries", async () => {
    deps.getCurrentUserFromRequest.mockResolvedValue({ id: 1 });
    deps.getGroupById.mockImplementation(async (id) => (id === 999 ? null : { id }));
    deps.getGroups.mockResolvedValue([{ id: 1 }]);
    deps.getExpenses.mockResolvedValue({ items: [], page: 1, pageSize: 1, totalItems: 0, totalPages: 1 });
    deps.getExpenseDetailForGroup.mockImplementation(async (gid, eid) => {
      if (eid === 1) return { expense: { id: 1, date: "2024-01-01", memberIds: [1], shares: [{ userId: 1, amount: 10 }], paidByUserId: 1, currency: "RON" } };
      if (eid === 2) return { expense: { id: 2, date: new Date(), participants: [{ userId: 1, amount: 10 }], paidByUser: { id: 1 } } };
      if (eid === 3) return { expense: { id: 3, date: new Date(), participants: [{ userId: 1, amount: 10 }], paidBy: { id: 1 } } };
      if (eid === 999) return null;
      return { expense: { id: eid, date: "2024-01-01" } };
    });
    deps.getGroupStats.mockImplementation(async (id) =>
      id === 999 ? null : { group: { id }, totalSpent: 0, topCategoryAmount: 0, categories: [], months: [], balance: { net: 0, youOweTo: [], othersOweToYou: [] } },
    );
    deps.getPayments.mockResolvedValue([]);
    deps.getGeneratorStatus.mockResolvedValue({ running: true, intervalMs: 1, generatedCount: 1 });
    deps.getDashboardSummary.mockResolvedValue({ overall: {} });

    const q = `
    query {
      me { id }
      groups { id }
      g1: group(groupId: 1) { id }
      g999: group(groupId: 999) { id }
      expenses(groupId: 1, pagination: { page: 1 }) { page }
      e1: expense(groupId: 1, expenseId: 1) { id }
      e2: expense(groupId: 1, expenseId: 2) { id }
      e3: expense(groupId: 1, expenseId: 3) { id }
      e999: expense(groupId: 1, expenseId: 999) { id }
      gs1: groupStats(groupId: 1) { groupId }
      gs999: groupStats(groupId: 999) { groupId }
      payments(groupId: 1) { id }
      generatorStatus { running }
      dashboard { userId }
    }
    `;
    const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: q }) });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("POST dashboard query covers fallback branches", async () => {
    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    deps.getUsers.mockResolvedValueOnce([{ id: 42 }]);
    deps.getDashboardSummary.mockResolvedValueOnce({ overall: {} });
    const req1 = new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: `query { dashboard { userId } }` }) });
    await POST(req1);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    deps.getUsers.mockResolvedValueOnce([]);
    const req2 = new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: `query { dashboard { userId } }` }) });
    await POST(req2);
  });

  it("POST executes success mutations", async () => {
    deps.getCurrentUserFromRequest.mockResolvedValue({ id: 1 });
    deps.signupUser.mockResolvedValue({
      token: "token123",
      user: { id: 1, username: "user1", email: "user1@test.com", createdAt: "2024-01-01T00:00:00.000Z" },
      role: "user",
      permissions: [],
    });
    deps.loginUser.mockResolvedValue({
      token: "token123",
      user: { id: 1, username: "user1", email: "user1@test.com", createdAt: "2024-01-01T00:00:00.000Z" },
      role: "admin",
      permissions: ["groups.deleteAny", "users.viewAll"],
    });
    deps.createGroup.mockResolvedValue({ id: 1 });
    deps.updateGroup.mockImplementation(async (id) => (id === 999 ? null : { id }));
    deps.deleteGroup.mockImplementation(async (id) => (id === 999 ? null : { id }));
    deps.addMemberToGroup.mockResolvedValue({ id: 1 });
    deps.removeMemberFromGroup.mockResolvedValue({ id: 1 });
    deps.leaveGroup.mockResolvedValue({ id: 1 });
    
    deps.createExpense.mockResolvedValue({ id: 1, title: "Test Expense", amount: 10, currency: "RON", category: "other", date: "2024-01-01T00:00:00Z", paidByUserId: 1, splitType: "equal", memberIds: [1], shares: [] });
    deps.updateExpense.mockImplementation(async (gid, eid) => (eid === 999 ? null : { id: eid, title: "Test Expense", amount: 10, currency: "RON", category: "other", date: "2024-01-01T00:00:00Z", paidByUserId: 1, splitType: "equal", memberIds: [1], shares: [] }));
    deps.deleteExpense.mockImplementation(async (gid, eid) => (eid === 999 ? null : { id: eid, title: "Test Expense", amount: 10, currency: "RON", category: "other", date: "2024-01-01T00:00:00Z", paidByUserId: 1, splitType: "equal", memberIds: [1], shares: [] }));
    
    deps.createPayment.mockResolvedValue({ id: 1, groupId: 1, fromUserId: 1, toUserId: 2, amount: 10, date: "2024-01-01T00:00:00Z" });
    deps.startGenerator.mockResolvedValue({ running: true, intervalMs: 1500, generatedCount: 1, groupId: 1 });
    deps.stopGenerator.mockReturnValue({ running: false, intervalMs: 1500, generatedCount: 1, groupId: null });

    const m = `
    mutation {
      signup(username:"user123", email:"user123@test.com", password:"secret123", confirmPassword:"secret123") { token }
      login(identifier:"user123", password:"secret123") { token role permissions }
      createGroup(input: {name:"Test Group", category:"other"}) { group { id } }
      updateGroup(groupId: 1, input: {name:"Updated Group"}) { group { id } }
      deleteGroup(groupId: 1) { group { id } }
      addMember(groupId: 1, identifier: "user123") { group { id } }
      removeMember(groupId: 1, userId: 1) { group { id } }
      leaveGroup(groupId: 1) { group { id } }
      createExpense(groupId: 1, input: {title:"Test Expense", amount:10, currency:"RON", category:"other", date:"2024-01-01T00:00:00Z", paidByUserId:1, splitType:"equal", memberIds:[1], shares:[]}) { expense { id } }
      updateExpense(groupId: 1, expenseId: 1, input: {title:"Test Expense", amount:10, currency:"RON", category:"other", date:"2024-01-01T00:00:00Z", paidByUserId:1, splitType:"equal", memberIds:[1], shares:[]}) { expense { id } }
      deleteExpense(groupId: 1, expenseId: 1) { expense { id } }
      createPayment(groupId: 1, input: {fromUserId:1, toUserId:2, amount:10}) { Payment { id } }
      startGenerator(groupId: 1) { status { running } }
      startGeneratorNoId: startGenerator { status { running } }
      stopGenerator { status { running } }
    }
    `;
    const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: m }) });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("POST executes mutations returning Not Found logic independently", async () => {
    deps.getCurrentUserFromRequest.mockResolvedValue({ id: 1 });
    deps.updateGroup.mockResolvedValue(null);
    deps.deleteGroup.mockResolvedValue(null);
    deps.updateExpense.mockResolvedValue(null);
    deps.deleteExpense.mockResolvedValue(null);

    const m1 = `mutation { updateGroup(groupId: 999, input: {name:"Updated Group"}) { group { id } } }`;
    const req1 = new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: m1 }) });
    const res1 = await POST(req1);
    expect(res1.status).toBe(400);

    const m2 = `mutation { deleteGroup(groupId: 999) { group { id } } }`;
    const req2 = new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: m2 }) });
    const res2 = await POST(req2);
    expect(res2.status).toBe(400);

    const m3 = `mutation { updateExpense(groupId: 1, expenseId: 999, input: {title:"Test Expense", amount:10, currency:"RON", category:"other", date:"2024-01-01T00:00:00Z", paidByUserId:1, splitType:"equal", memberIds:[1], shares:[]}) { expense { id } } }`;
    const req3 = new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: m3 }) });
    const res3 = await POST(req3);
    expect(res3.status).toBe(400);

    const m4 = `mutation { deleteExpense(groupId: 1, expenseId: 999) { expense { id } } }`;
    const req4 = new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: m4 }) });
    const res4 = await POST(req4);
    expect(res4.status).toBe(400);
  });

  it("POST executes mutations failing on Authentication", async () => {
    deps.getCurrentUserFromRequest.mockResolvedValue(null);
    const mAuth = `
    mutation {
      createGroup(input: {name:"Test Group", category:"other"}) { group { id } }
      addMember(groupId: 1, identifier: "user123") { group { id } }
      removeMember(groupId: 1, userId: 1) { group { id } }
      leaveGroup(groupId: 1) { group { id } }
      createExpense(groupId: 1, input: {title:"Test Expense", amount:10, currency:"RON", category:"other", date:"2024-01-01T00:00:00Z", paidByUserId:1, splitType:"equal", memberIds:[1], shares:[]}) { expense { id } }
      updateExpense(groupId: 1, expenseId: 1, input: {title:"Test Expense", amount:10, currency:"RON", category:"other", date:"2024-01-01T00:00:00Z", paidByUserId:1, splitType:"equal", memberIds:[1], shares:[]}) { expense { id } }
      deleteExpense(groupId: 1, expenseId: 1) { expense { id } }
      createPayment(groupId: 1, input: {fromUserId:1, toUserId:2, amount:10}) { Payment { id } }
    }
    `;
    const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: mAuth }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("covers edge cases in mappers and fallbacks", async () => {
    deps.getCurrentUserFromRequest.mockResolvedValue({ id: 1 });
    deps.getGroupById.mockImplementation(async (id) => id === 77 ? null : { id });
    deps.getExpenses.mockResolvedValue({ items: [], page: 1, pageSize: 1, totalItems: 0, totalPages: 1 });
    deps.getExpenseDetailForGroup.mockResolvedValue({
      expense: { id: 99, groupId: 1, title: "Bare", amount: 10, splitType: "equal", category: "other", date: "2024-01-01", paidByUserId: 1 }
    });
    
    const dummyGroup = { id: 77, name: "G", category: "other", memberIds: [], adminIds: [] };
    deps.removeMemberFromGroup.mockResolvedValue(dummyGroup);
    deps.leaveGroup.mockResolvedValue(dummyGroup);

    const q1 = `
    query {
      expenses(groupId: 1) { page }
      expense(groupId: 1, expenseId: 99) { id paidBy { id } }
    }
    `;
    const res1 = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: q1 }) }));
    expect(res1.status).toBe(200);

    const q2 = `
    mutation {
      removeMember(groupId: 77, userId: 1) { group { id isMember } }
      leaveGroup(groupId: 77) { group { id isMember } }
    }
    `;
    const res2 = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: q2 }) }));
    expect(res2.status).toBe(200);
  });

  it("handles non-Error objects thrown in GraphQL execution", async () => {
    deps.getCurrentUserFromRequest.mockImplementationOnce(() => { throw "String error"; });
    const res = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ query: "query { me { id } }" }) }));
    expect(res.status).toBe(400);
  });
});