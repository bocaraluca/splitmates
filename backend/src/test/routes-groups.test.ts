import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("groups routes", () => {
  it("/groups GET and POST cover auth and success", async () => {
    const getCurrentUserFromRequest = vi.fn();
    const getGroupsForUserId = vi.fn();
    const getGroups = vi.fn();
    const createGroup = vi.fn();
    const mapGroupForResponse = vi.fn();
    const getUserPermissions = vi.fn();

    vi.doMock("@/lib/splitmates", () => ({
      getCurrentUserFromRequest,
      getGroupsForUserId,
      getGroups,
      createGroup,
    }));
    vi.doMock("@/lib/splitmates/api/group-response", () => ({ mapGroupForResponse }));
    vi.doMock("@/lib/splitmates/services/auth/permissions-service", () => ({ getUserPermissions }));

    const mod = await import("@/app/api/groups/route");

    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const unauthorized = await mod.GET(new Request("http://localhost/api/groups"));
    expect(unauthorized.status).toBe(401);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    getUserPermissions.mockResolvedValueOnce({ role: "user", permissions: [] });
    getGroupsForUserId.mockResolvedValueOnce([{ id: 10 }]);
    mapGroupForResponse.mockResolvedValueOnce({ id: 10, name: "A" });
    const okGet = await mod.GET(new Request("http://localhost/api/groups"));
    expect(okGet.status).toBe(200);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 2 });
    getUserPermissions.mockResolvedValueOnce({ role: "admin", permissions: ["View all groups"] });
    getGroups.mockResolvedValueOnce([{ id: 10 }, { id: 11 }]);
    mapGroupForResponse.mockResolvedValueOnce({ id: 10, name: "A" });
    mapGroupForResponse.mockResolvedValueOnce({ id: 11, name: "B" });
    const okGetAdmin = await mod.GET(new Request("http://localhost/api/groups"));
    expect(okGetAdmin.status).toBe(200);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    createGroup.mockResolvedValueOnce({ id: 11, name: "New" });
    mapGroupForResponse.mockResolvedValueOnce({ id: 11, name: "New" });
    const okPost = await mod.POST(new Request("http://localhost/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "New Group", category: "household" }),
    }));
    expect(okPost.status).toBe(201);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    createGroup.mockRejectedValueOnce("boom");
    const nonErrorCreate = await mod.POST(new Request("http://localhost/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Valid Group", category: "household" }),
    }));
    expect(nonErrorCreate.status).toBe(400);
  });

  it("/groups/[groupId] GET PATCH DELETE cover status branches", async () => {
    const deps = {
      getCurrentUserFromRequest: vi.fn(),
      getGroupById: vi.fn(),
      getDashboardSummary: vi.fn(),
      updateGroup: vi.fn(),
      deleteGroup: vi.fn(),
    };
    const mapGroupForResponse = vi.fn();

    vi.doMock("@/lib/splitmates", () => deps);
    vi.doMock("@/lib/splitmates/api/group-response", () => ({ mapGroupForResponse }));

    const mod = await import("@/app/api/groups/[groupId]/route");

    const badId = await mod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x" }) });
    expect(badId.status).toBe(400);

    deps.getGroupById.mockResolvedValueOnce(null);
    const notFound = await mod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) });
    expect(notFound.status).toBe(404);

    deps.getGroupById.mockResolvedValueOnce({ id: 1, memberIds: [1] });
    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const noAuth = await mod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) });
    expect(noAuth.status).toBe(401);

    deps.getGroupById.mockResolvedValueOnce({ id: 1, memberIds: [1] });
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 2 });
    const forbidden = await mod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) });
    expect(forbidden.status).toBe(403);

    deps.getGroupById.mockResolvedValueOnce({ id: 1, memberIds: [1] });
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getDashboardSummary.mockResolvedValueOnce({ overall: {} });
    mapGroupForResponse.mockResolvedValueOnce({ id: 1 });
    const okGet = await mod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) });
    expect(okGet.status).toBe(200);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.updateGroup.mockResolvedValueOnce({ id: 1, name: "Updated" });
    const okPatch = await mod.PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(okPatch.status).toBe(200);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.updateGroup.mockResolvedValueOnce(null);
    const patchMissing = await mod.PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(patchMissing.status).toBe(404);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.deleteGroup.mockResolvedValueOnce(null);
    const delMissing = await mod.DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(delMissing.status).toBe(404);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.deleteGroup.mockResolvedValueOnce({ id: 1 });
    const okDel = await mod.DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(okDel.status).toBe(200);
  });

  it("expenses list/create and detail patch/delete routes cover branches", async () => {
    const deps = {
      getGroupById: vi.fn(),
      getExpenses: vi.fn(),
      getCurrentUserFromRequest: vi.fn(),
      createExpense: vi.fn(),
      getExpenseDetailForGroup: vi.fn(),
      updateExpense: vi.fn(),
      deleteExpense: vi.fn(),
    };

    vi.doMock("@/lib/splitmates", () => deps);

    const listMod = await import("@/app/api/groups/[groupId]/expenses/route");
    const detailMod = await import("@/app/api/groups/[groupId]/expenses/[expenseId]/route");

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    const invalidList = await listMod.GET(new Request("http://localhost?x=1"), { params: Promise.resolve({ groupId: "x" }) });
    expect(invalidList.status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getGroupById.mockResolvedValueOnce(null);
    const missingGroup = await listMod.GET(new Request("http://localhost?page=1&pageSize=5"), { params: Promise.resolve({ groupId: "1" }) });
    expect(missingGroup.status).toBe(404);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getGroupById.mockResolvedValueOnce({ id: 1 });
    deps.getExpenses.mockResolvedValueOnce({ items: [], page: 1, pageSize: 5, totalItems: 0, totalPages: 1 });
    const okList = await listMod.GET(new Request("http://localhost?page=1&pageSize=5"), { params: Promise.resolve({ groupId: "1" }) });
    expect(okList.status).toBe(200);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const unauthCreate = await listMod.POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(unauthCreate.status).toBe(401);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.createExpense.mockResolvedValueOnce({ id: 9 });
    const okCreate = await listMod.POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Rent", amount: 10, currency: "RON", category: "rent", date: new Date().toISOString(), paidByUserId: 1, splitType: "equal", memberIds: [1], shares: [] }),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(okCreate.status).toBe(201);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    const invalidDetail = await detailMod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x", expenseId: "y" }) });
    expect(invalidDetail.status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getGroupById.mockResolvedValueOnce(null);
    const missingGroupDetail = await detailMod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1", expenseId: "2" }) });
    expect(missingGroupDetail.status).toBe(404);

    deps.getGroupById.mockResolvedValueOnce({ id: 1 });
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getExpenseDetailForGroup.mockResolvedValueOnce(null);
    const missingExpense = await detailMod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1", expenseId: "2" }) });
    expect(missingExpense.status).toBe(404);

    deps.getGroupById.mockResolvedValueOnce({ id: 1 });
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getExpenseDetailForGroup.mockResolvedValueOnce({ expense: { id: 2 } });
    const okDetail = await detailMod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1", expenseId: "2" }) });
    expect(okDetail.status).toBe(200);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const unauthPatch = await detailMod.PATCH(new Request("http://localhost", { method: "PATCH" }), { params: Promise.resolve({ groupId: "1", expenseId: "2" }) });
    expect(unauthPatch.status).toBe(401);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.updateExpense.mockResolvedValueOnce(null);
    const patchMissing = await detailMod.PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Rent", amount: 10, currency: "RON", category: "rent", date: new Date().toISOString(), paidByUserId: 1, splitType: "equal", memberIds: [1], shares: [] }),
    }), { params: Promise.resolve({ groupId: "1", expenseId: "2" }) });
    expect(patchMissing.status).toBe(404);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.updateExpense.mockResolvedValueOnce({ id: 2 });
    const okPatch = await detailMod.PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Rent", amount: 10, currency: "RON", category: "rent", date: new Date().toISOString(), paidByUserId: 1, splitType: "equal", memberIds: [1], shares: [] }),
    }), { params: Promise.resolve({ groupId: "1", expenseId: "2" }) });
    expect(okPatch.status).toBe(200);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const unauthDelete = await detailMod.DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", expenseId: "2" }) });
    expect(unauthDelete.status).toBe(401);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.deleteExpense.mockResolvedValueOnce(null);
    const missingDelete = await detailMod.DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", expenseId: "2" }) });
    expect(missingDelete.status).toBe(404);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.deleteExpense.mockResolvedValueOnce({ id: 2 });
    const okDelete = await detailMod.DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", expenseId: "2" }) });
    expect(okDelete.status).toBe(200);
  });

  it("leave/members/payments/stats routes cover happy and error branches", async () => {
    const deps = {
      getCurrentUserFromRequest: vi.fn(),
      leaveGroup: vi.fn(),
      addMemberToGroup: vi.fn(),
      getUserRecordByIdentifier: vi.fn(),
      getUserById: vi.fn(),
      removeMemberFromGroup: vi.fn(),
      getGroupById: vi.fn(),
      getPayments: vi.fn(),
      createPayment: vi.fn(),
      getGroupStats: vi.fn(),
    };
    const mapGroupForResponse = vi.fn();

    vi.doMock("@/lib/splitmates", () => deps);
    vi.doMock("@/lib/splitmates/api/group-response", () => ({ mapGroupForResponse }));

    const leaveMod = await import("@/app/api/groups/[groupId]/leave/route");
    const membersMod = await import("@/app/api/groups/[groupId]/members/route");
    const paymentsMod = await import("@/app/api/groups/[groupId]/payments/route");
    const statsMod = await import("@/app/api/groups/[groupId]/stats/route");

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const unauthLeave = await leaveMod.POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(unauthLeave.status).toBe(401);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.leaveGroup.mockResolvedValueOnce({ id: 1 });
    const okLeave = await leaveMod.POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(okLeave.status).toBe(200);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const unauthAdd = await membersMod.POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(unauthAdd.status).toBe(401);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const unauthRemove = await membersMod.DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(unauthRemove.status).toBe(401);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.addMemberToGroup.mockResolvedValueOnce({ id: 1 });
    deps.getUserRecordByIdentifier.mockResolvedValueOnce({ id: 2 });
    deps.getUserById.mockResolvedValueOnce({ id: 2, username: "ana" });
    mapGroupForResponse.mockResolvedValueOnce({ id: 1 });
    const okAdd = await membersMod.POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "ana" }),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(okAdd.status).toBe(200);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.addMemberToGroup.mockResolvedValueOnce({ id: 1 });
    deps.getUserRecordByIdentifier.mockResolvedValueOnce(null);
    mapGroupForResponse.mockResolvedValueOnce({ id: 1 });
    const okAddWithoutUserRecord = await membersMod.POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "ghost" }),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(okAddWithoutUserRecord.status).toBe(200);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getUserById.mockResolvedValueOnce(null);
    const del404 = await membersMod.DELETE(new Request("http://localhost", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: 44 }),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(del404.status).toBe(404);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    const del404NoTarget = await membersMod.DELETE(new Request("http://localhost", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(del404NoTarget.status).toBe(404);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getUserById.mockResolvedValueOnce({ id: 2, username: "ana" });
    deps.removeMemberFromGroup.mockResolvedValueOnce({ id: 1 });
    mapGroupForResponse.mockResolvedValueOnce({ id: 1 });
    const del200 = await membersMod.DELETE(new Request("http://localhost", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: 2 }),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(del200.status).toBe(200);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getUserById.mockResolvedValueOnce({ id: 3, username: "ion" });
    deps.removeMemberFromGroup.mockResolvedValueOnce(null);
    const del200NullGroup = await membersMod.DELETE(new Request("http://localhost", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: 3 }),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(del200NullGroup.status).toBe(200);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    const payInvalid = await paymentsMod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x" }) });
    expect(payInvalid.status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getGroupById.mockResolvedValueOnce(null);
    const pay404 = await paymentsMod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) });
    expect(pay404.status).toBe(404);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getGroupById.mockResolvedValueOnce({ id: 1 });
    deps.getPayments.mockResolvedValueOnce([]);
    const pay200 = await paymentsMod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) });
    expect(pay200.status).toBe(200);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const payUnauth = await paymentsMod.POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(payUnauth.status).toBe(401);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.createPayment.mockResolvedValueOnce({ id: 1 });
    const payCreate = await paymentsMod.POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromUserId: 1, toUserId: 2, amount: 10 }),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(payCreate.status).toBe(201);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    const statsInvalid = await statsMod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x" }) });
    expect(statsInvalid.status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getGroupById.mockResolvedValueOnce(null);
    const stats404 = await statsMod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) });
    expect(stats404.status).toBe(404);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getGroupById.mockResolvedValueOnce({ id: 1 });
    deps.getGroupStats.mockResolvedValueOnce({ totalSpent: 10 });
    const stats200 = await statsMod.GET(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) });
    expect(stats200.status).toBe(200);
  });

  it("covers remaining error branches and unauth cases", async () => {
    const deps = {
      getCurrentUserFromRequest: vi.fn(),
      getGroupsForUserId: vi.fn(),
      createGroup: vi.fn(),
      getGroupById: vi.fn(),
      getDashboardSummary: vi.fn(),
      updateGroup: vi.fn(),
      deleteGroup: vi.fn(),
      getExpenses: vi.fn(),
      createExpense: vi.fn(),
      getExpenseDetailForGroup: vi.fn(),
      updateExpense: vi.fn(),
      deleteExpense: vi.fn(),
      leaveGroup: vi.fn(),
      addMemberToGroup: vi.fn(),
      getUserRecordByIdentifier: vi.fn(),
      getUserById: vi.fn(),
      removeMemberFromGroup: vi.fn(),
      getPayments: vi.fn(),
      createPayment: vi.fn(),
      getGroupStats: vi.fn(),
    };
    const mapGroupForResponse = vi.fn();

    vi.doMock("@/lib/splitmates", () => deps);
    vi.doMock("@/lib/splitmates/api/group-response", () => ({ mapGroupForResponse }));

    const groupsMod = await import("@/app/api/groups/route");
    const groupMod = await import("@/app/api/groups/[groupId]/route");
    const expListMod = await import("@/app/api/groups/[groupId]/expenses/route");
    const expDetMod = await import("@/app/api/groups/[groupId]/expenses/[expenseId]/route");
    const leaveMod = await import("@/app/api/groups/[groupId]/leave/route");
    const memMod = await import("@/app/api/groups/[groupId]/members/route");
    const payMod = await import("@/app/api/groups/[groupId]/payments/route");

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    expect((await groupsMod.POST(new Request("http://localhost"))).status).toBe(401);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await groupsMod.POST(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    expect((await groupMod.PATCH(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(401);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await groupMod.PATCH(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await groupMod.PATCH(new Request("http://localhost", { method: "PATCH", body: "{" }), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    expect((await groupMod.DELETE(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(401);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await groupMod.DELETE(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.deleteGroup.mockRejectedValueOnce(new Error("err"));
    expect((await groupMod.DELETE(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.deleteGroup.mockRejectedValueOnce({ status: 409 });
    expect((await groupMod.DELETE(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(409);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getGroupById.mockResolvedValueOnce({ id: 1 });
    expect((await expListMod.GET(new Request("http://localhost?page=invalid"), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.getGroupById.mockResolvedValueOnce({ id: 1 });
    deps.getExpenses.mockRejectedValueOnce(new Error("err"));
    expect((await expListMod.GET(new Request("http://localhost?page=1&pageSize=5"), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(500);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await expListMod.POST(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await expListMod.POST(new Request("http://localhost", { method: "POST", body: "{" }), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await expDetMod.PATCH(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x", expenseId: "1" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await expDetMod.PATCH(new Request("http://localhost", { method: "PATCH", body: "{" }), { params: Promise.resolve({ groupId: "1", expenseId: "1" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.updateExpense.mockRejectedValueOnce({ status: 422 });
    expect((await expDetMod.PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Rent", amount: 10, currency: "RON", category: "rent", date: new Date().toISOString(), paidByUserId: 1, splitType: "equal", memberIds: [1], shares: [] }),
    }), { params: Promise.resolve({ groupId: "1", expenseId: "1" }) })).status).toBe(422);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await expDetMod.DELETE(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x", expenseId: "1" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.deleteExpense.mockRejectedValueOnce(new Error("err"));
    expect((await expDetMod.DELETE(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1", expenseId: "1" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.deleteExpense.mockRejectedValueOnce({ status: 409 });
    expect((await expDetMod.DELETE(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1", expenseId: "1" }) })).status).toBe(409);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await leaveMod.POST(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.leaveGroup.mockRejectedValueOnce(new Error("err"));
    expect((await leaveMod.POST(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await memMod.POST(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await memMod.POST(new Request("http://localhost", { method: "POST", body: "{" }), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await memMod.DELETE(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.removeMemberFromGroup.mockRejectedValueOnce(new Error("err"));
    deps.getUserRecordByIdentifier.mockResolvedValueOnce({ id: 5 });
    deps.getUserById.mockResolvedValueOnce({ id: 5, username: "test" });
    expect((await memMod.DELETE(new Request("http://localhost", { method: "DELETE", body: JSON.stringify({ identifier: "test" }) }), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce(null);
    expect((await payMod.POST(new Request("http://localhost"), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(401);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await payMod.POST(new Request("http://localhost"), { params: Promise.resolve({ groupId: "x" }) })).status).toBe(400);
    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    expect((await payMod.POST(new Request("http://localhost", { method: "POST", body: "{" }), { params: Promise.resolve({ groupId: "1" }) })).status).toBe(400);
  });

  it("covers non-Error catch block fallbacks for all routes", async () => {
    const deps = {
      getCurrentUserFromRequest: vi.fn(),
      getGroupById: vi.fn(),
      createGroup: vi.fn(),
      updateGroup: vi.fn(),
      deleteGroup: vi.fn(),
      getExpenses: vi.fn(),
      createExpense: vi.fn(),
      updateExpense: vi.fn(),
      deleteExpense: vi.fn(),
      leaveGroup: vi.fn(),
      addMemberToGroup: vi.fn(),
      createPayment: vi.fn(),
    };
    const mapGroupForResponse = vi.fn();

    vi.doMock("@/lib/splitmates", () => deps);
    vi.doMock("@/lib/splitmates/api/group-response", () => ({ mapGroupForResponse }));

    const groupsMod = await import("@/app/api/groups/route");
    const groupMod = await import("@/app/api/groups/[groupId]/route");
    const expListMod = await import("@/app/api/groups/[groupId]/expenses/route");
    const expDetMod = await import("@/app/api/groups/[groupId]/expenses/[expenseId]/route");
    const leaveMod = await import("@/app/api/groups/[groupId]/leave/route");
    const memMod = await import("@/app/api/groups/[groupId]/members/route");
    const payMod = await import("@/app/api/groups/[groupId]/payments/route");

    deps.getCurrentUserFromRequest.mockResolvedValue({ id: 1 });
    deps.getGroupById.mockResolvedValue({ id: 1 });

    deps.createGroup.mockRejectedValueOnce("Non-Error String");
    const res1 = await groupsMod.POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "A", category: "other" })
    }));
    expect(res1.status).toBe(400);

    deps.updateGroup.mockRejectedValueOnce("Non-Error String");
    const res2 = await groupMod.PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "B" })
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(res2.status).toBe(400);

    deps.deleteGroup.mockRejectedValueOnce("Non-Error String");
    const res3 = await groupMod.DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(res3.status).toBe(400);

    deps.getExpenses.mockRejectedValueOnce("Non-Error String");
    const res4 = await expListMod.GET(new Request("http://localhost?page=1"), { params: Promise.resolve({ groupId: "1" }) });
    expect(res4.status).toBe(500);

    deps.createExpense.mockRejectedValueOnce("Non-Error String");
    const res5 = await expListMod.POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Rent", amount: 10, currency: "RON", category: "rent", date: new Date().toISOString(), paidByUserId: 1, splitType: "equal", memberIds: [1], shares: [] })
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(res5.status).toBe(400);

    deps.updateExpense.mockRejectedValueOnce("Non-Error String");
    const res6 = await expDetMod.PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Rent", amount: 10, currency: "RON", category: "rent", date: new Date().toISOString(), paidByUserId: 1, splitType: "equal", memberIds: [1], shares: [] })
    }), { params: Promise.resolve({ groupId: "1", expenseId: "2" }) });
    expect(res6.status).toBe(400);

    deps.deleteExpense.mockRejectedValueOnce("Non-Error String");
    const res7 = await expDetMod.DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1", expenseId: "2" }) });
    expect(res7.status).toBe(400);

    deps.leaveGroup.mockRejectedValueOnce("Non-Error String");
    const res8 = await leaveMod.POST(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(res8.status).toBe(400);

    deps.addMemberToGroup.mockRejectedValueOnce("Non-Error String");
    const res9 = await memMod.POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "ana" })
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(res9.status).toBe(400);

    deps.createPayment.mockRejectedValueOnce("Non-Error String");
    const res10 = await payMod.POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromUserId: 1, toUserId: 2, amount: 10 })
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(res10.status).toBe(400);
  });

  it("covers remaining groups and members error branches", async () => {
    const deps = {
      getCurrentUserFromRequest: vi.fn(),
      getGroupById: vi.fn(),
      createGroup: vi.fn(),
      updateGroup: vi.fn(),
      deleteGroup: vi.fn(),
      getExpenses: vi.fn(),
      createExpense: vi.fn(),
      updateExpense: vi.fn(),
      deleteExpense: vi.fn(),
      leaveGroup: vi.fn(),
      addMemberToGroup: vi.fn(),
      createPayment: vi.fn(),
      getUserPermissions: vi.fn(),
      getGroupsForUserId: vi.fn(),
      getGroups: vi.fn(),
      getDashboardSummary: vi.fn(),
      getUserRecordByIdentifier: vi.fn(),
      getUserById: vi.fn(),
      removeMemberFromGroup: vi.fn(),
    };
    const mapGroupForResponse = vi.fn();

    vi.doMock("@/lib/splitmates", () => deps);
    vi.doMock("@/lib/splitmates/api/group-response", () => ({ mapGroupForResponse }));
    vi.doMock("@/lib/splitmates/services/auth/permissions-service", () => ({ getUserPermissions: deps.getUserPermissions }));

    const groupsMod = await import("@/app/api/groups/route");
    const groupMod = await import("@/app/api/groups/[groupId]/route");
    const membersMod = await import("@/app/api/groups/[groupId]/members/route");

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.createGroup.mockRejectedValueOnce("Non-Error String");
    const badCreate = await groupsMod.POST(new Request("http://localhost/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "A", category: "household" }),
    }));
    expect(badCreate.status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.updateGroup.mockRejectedValueOnce("Non-Error String");
    const badPatch = await groupMod.PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "AB" }),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(badPatch.status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.updateGroup.mockRejectedValueOnce({ status: 409 });
    const badPatchStatus = await groupMod.PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "AB" }),
    }), { params: Promise.resolve({ groupId: "1" }) });
    expect(badPatchStatus.status).toBe(409);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.deleteGroup.mockRejectedValueOnce("Non-Error String");
    const badDelete = await groupMod.DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(badDelete.status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.deleteGroup.mockRejectedValueOnce({ status: 403 });
    const badDeleteStatus = await groupMod.DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ groupId: "1" }) });
    expect(badDeleteStatus.status).toBe(403);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    const invalidMemberRemove = await membersMod.DELETE(new Request("http://localhost", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({}) }), { params: Promise.resolve({ groupId: "0" }) });
    expect(invalidMemberRemove.status).toBe(400);

    deps.getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deps.removeMemberFromGroup.mockRejectedValueOnce("Non-Error String");
    deps.getUserById.mockResolvedValueOnce({ id: 99, username: "test" });
    const badMemberRemove = await membersMod.DELETE(new Request("http://localhost", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: 99 }) }), { params: Promise.resolve({ groupId: "1" }) });
    expect(badMemberRemove.status).toBe(400);
  });
});