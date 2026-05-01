import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as loginPOST } from "./auth/login/route";
import { POST as signupPOST } from "./auth/signup/route";
import { GET as dashboardGET } from "./dashboard/route";
import { GET as eventsGET } from "./events/route";
import { POST as generatorStartPOST } from "./generator/start/route";
import { GET as groupsGET, POST as groupsPOST } from "./groups/route";
import { GET as groupGET, PATCH as groupPATCH, DELETE as groupDELETE } from "./groups/[groupId]/route";
import { GET as expensesGET, POST as expensesPOST } from "./groups/[groupId]/expenses/route";
import { GET as expenseGET, PATCH as expensePATCH, DELETE as expenseDELETE } from "./groups/[groupId]/expenses/[expenseId]/route";
import { POST as leavePOST } from "./groups/[groupId]/leave/route";
import { GET as statsGET } from "./groups/[groupId]/stats/route";
import { GET as settlementsGET, POST as settlementsPOST } from "./groups/[groupId]/settlements/route";
import { POST as memberPOST, DELETE as memberDELETE } from "./groups/[groupId]/members/route";
import { getState, resetSplitmatesStateForTests } from "@/lib/splitmates";

beforeEach(() => {
  resetSplitmatesStateForTests();
});

function request(url: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown, token?: string) {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function loginToken() {
  const response = await loginPOST(
    request("http://localhost/api/auth/login", "POST", { identifier: "raluca", password: "raluca" }),
  );
  const json = (await response.json()) as { token: string };
  return json.token;
}

describe("splitmates api routes", () => {
  it("rejects invalid auth payloads", async () => {
    const login = await loginPOST(request("http://localhost/api/auth/login", "POST", { identifier: "x", password: "x" }));
    expect(login.status).toBe(400);

    const signup = await signupPOST(
      request("http://localhost/api/auth/signup", "POST", {
        username: "maria",
        email: "maria@example.com",
        password: "secret123",
        confirmPassword: "bad",
      }),
    );
    expect(signup.status).toBe(400);
  });

  it("returns 404 when no users exist for the dashboard", async () => {
    const state = getState();
    state.users = [];
    const response = await dashboardGET(request("http://localhost/api/dashboard", "GET"));
    expect(response.status).toBe(404);
  });

  it("uses the default dashboard user when unauthenticated", async () => {
    const response = await dashboardGET(request("http://localhost/api/dashboard", "GET"));
    expect(response.status).toBe(200);
  });

  it("rejects invalid generator start payloads", async () => {
    const response = await generatorStartPOST(request("http://localhost/api/generator/start", "POST", { groupId: -5 }));
    expect(response.status).toBe(400);
  });

  it("starts the generator with an empty request body", async () => {
    const token = await loginToken();
    const response = await generatorStartPOST(new Request("http://localhost/api/generator/start", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }));
    expect(response.status).toBe(200);
  });

  it("streams updates and heartbeats", async () => {
    vi.useFakeTimers();
    const response = await eventsGET();
    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();

    const first = await reader!.read();
    expect(new TextDecoder().decode(first.value)).toContain("retry");

    const state = getState();
    state.emitter.emit("change", {
      type: "test",
      timestamp: new Date().toISOString(),
      data: { ok: true },
    });
    const updateChunk = await reader!.read();
    expect(new TextDecoder().decode(updateChunk.value)).toContain("event: update");

    await vi.advanceTimersByTimeAsync(15000);
    const pingChunk = await reader!.read();
    expect(new TextDecoder().decode(pingChunk.value)).toContain("event: ping");

    await reader!.cancel();
    vi.useRealTimers();
  });

  it("validates group list and group detail requests", async () => {
    const unauthorizedCreate = await groupsPOST(request("http://localhost/api/groups", "POST", { name: "A", category: "trip" }));
    expect(unauthorizedCreate.status).toBe(401);

    const token = await loginToken();

    const invalidGroupGet = await groupGET(request("http://localhost/api/groups/nope", "GET", undefined, token), {
      params: Promise.resolve({ groupId: "nope" }),
    });
    expect(invalidGroupGet.status).toBe(400);

    const notFoundGroupGet = await groupGET(request("http://localhost/api/groups/999", "GET", undefined, token), {
      params: Promise.resolve({ groupId: "999" }),
    });
    expect(notFoundGroupGet.status).toBe(404);

    const invalidPatch = await groupPATCH(request("http://localhost/api/groups/0", "PATCH", {}, token), {
      params: Promise.resolve({ groupId: "0" }),
    });
    expect(invalidPatch.status).toBe(400);

    const unauthPatch = await groupPATCH(request("http://localhost/api/groups/1", "PATCH", {}), {
      params: Promise.resolve({ groupId: "1" }),
    });
    expect(unauthPatch.status).toBe(401);

    const invalidDelete = await groupDELETE(request("http://localhost/api/groups/x", "DELETE", undefined, token), {
      params: Promise.resolve({ groupId: "x" }),
    });
    expect(invalidDelete.status).toBe(400);

    const unauthDelete = await groupDELETE(request("http://localhost/api/groups/1", "DELETE"), {
      params: Promise.resolve({ groupId: "1" }),
    });
    expect(unauthDelete.status).toBe(401);

    const notFoundDelete = await groupDELETE(request("http://localhost/api/groups/999", "DELETE", undefined, token), {
      params: Promise.resolve({ groupId: "999" }),
    });
    expect(notFoundDelete.status).toBe(404);

    const groups = await groupsGET(request("http://localhost/api/groups", "GET", undefined, token));
    expect(groups.status).toBe(200);

    const publicGroups = await groupsGET(request("http://localhost/api/groups", "GET"));
    expect(publicGroups.status).toBe(401);
  });

  it("validates group member expense settlement and leave requests", async () => {
    const token = await loginToken();

    const created = await groupsPOST(
      request("http://localhost/api/groups", "POST", { name: "Branch Group", category: "friends" }, token),
    );
    const groupId = ((await created.json()) as { group: { id: number } }).group.id;

    const badExpenseList = await expensesGET(request("http://localhost/api/groups/x/expenses", "GET", undefined, token), {
      params: Promise.resolve({ groupId: "x" }),
    });
    expect(badExpenseList.status).toBe(400);

    const missingGroupExpenseList = await expensesGET(request("http://localhost/api/groups/999/expenses", "GET", undefined, token), {
      params: Promise.resolve({ groupId: "999" }),
    });
    expect(missingGroupExpenseList.status).toBe(404);

    const invalidPaginationExpenseList = await expensesGET(
      request("http://localhost/api/groups/1/expenses?page=1&pageSize=8", "GET", undefined, token),
      { params: Promise.resolve({ groupId: "1" }) },
    );
    expect(invalidPaginationExpenseList.status).toBe(400);

    const unauthExpenseCreate = await expensesPOST(
      request("http://localhost/api/groups/1/expenses", "POST", {
        title: "X",
        amount: 10,
        currency: "RON",
        category: "food",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "equal",
        memberIds: [1],
        shares: [],
      }),
      { params: Promise.resolve({ groupId: String(groupId) }) },
    );
    expect(unauthExpenseCreate.status).toBe(401);

    const invalidLeave = await leavePOST(request("http://localhost/api/groups/x/leave", "POST", undefined, token), {
      params: Promise.resolve({ groupId: "x" }),
    });
    expect(invalidLeave.status).toBe(400);

    const invalidStats = await statsGET(request("http://localhost/api/groups/x/stats", "GET", undefined, token), {
      params: Promise.resolve({ groupId: "x" }),
    });
    expect(invalidStats.status).toBe(400);

    const missingStats = await statsGET(request("http://localhost/api/groups/999/stats", "GET", undefined, token), {
      params: Promise.resolve({ groupId: "999" }),
    });
    expect(missingStats.status).toBe(404);

    const badSettlementsGet = await settlementsGET(request("http://localhost/api/groups/x/settlements", "GET", undefined, token), {
      params: Promise.resolve({ groupId: "x" }),
    });
    expect(badSettlementsGet.status).toBe(400);

    const missingSettlementsGet = await settlementsGET(
      request("http://localhost/api/groups/999/settlements", "GET", undefined, token),
      { params: Promise.resolve({ groupId: "999" }) },
    );
    expect(missingSettlementsGet.status).toBe(404);

    const unauthSettlementCreate = await settlementsPOST(
      request("http://localhost/api/groups/1/settlements", "POST", { fromUserId: 1, toUserId: 2, amount: 10 }),
      { params: Promise.resolve({ groupId: String(groupId) }) },
    );
    expect(unauthSettlementCreate.status).toBe(401);

    const badMemberAdd = await memberPOST(
      request("http://localhost/api/groups/x/members", "POST", { identifier: "ana" }, token),
      { params: Promise.resolve({ groupId: "x" }) },
    );
    expect(badMemberAdd.status).toBe(400);

    const badMemberDelete = await memberDELETE(
      request("http://localhost/api/groups/x/members", "DELETE", { identifier: "ana" }, token),
      { params: Promise.resolve({ groupId: "x" }) },
    );
    expect(badMemberDelete.status).toBe(400);

    const noTargetDelete = await memberDELETE(
      request("http://localhost/api/groups/1/members", "DELETE", { identifier: "nobody" }, token),
      { params: Promise.resolve({ groupId: String(groupId) }) },
    );
    expect(noTargetDelete.status).toBe(404);

    const unauthMemberAdd = await memberPOST(
      request("http://localhost/api/groups/1/members", "POST", { identifier: "ana" }),
      { params: Promise.resolve({ groupId: String(groupId) }) },
    );
    expect(unauthMemberAdd.status).toBe(401);

    const unknownMemberAdd = await memberPOST(
      request("http://localhost/api/groups/1/members", "POST", { identifier: "nobody" }, token),
      { params: Promise.resolve({ groupId: String(groupId) }) },
    );
    expect(unknownMemberAdd.status).toBe(400);

    const unauthMemberDelete = await memberDELETE(
      request("http://localhost/api/groups/1/members", "DELETE", { identifier: "ana" }),
      { params: Promise.resolve({ groupId: String(groupId) }) },
    );
    expect(unauthMemberDelete.status).toBe(401);

    const badMemberDeleteBusiness = await memberDELETE(
      request("http://localhost/api/groups/1/members", "DELETE", { identifier: "elena" }, token),
      { params: Promise.resolve({ groupId: String(groupId) }) },
    );
    expect(badMemberDeleteBusiness.status).toBe(400);

    const invalidExpenseCreate = await expensesPOST(
      request("http://localhost/api/groups/x/expenses", "POST", {
        title: "Y",
        amount: 10,
        currency: "RON",
        category: "food",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "equal",
        memberIds: [1],
        shares: [],
      }, token),
      { params: Promise.resolve({ groupId: "x" }) },
    );
    expect(invalidExpenseCreate.status).toBe(400);

    const badExpenseBody = await expensesPOST(
      request("http://localhost/api/groups/1/expenses", "POST", {
        title: "short",
        amount: 10,
        category: "food",
      }, token),
      { params: Promise.resolve({ groupId: String(groupId) }) },
    );
    expect(badExpenseBody.status).toBe(400);

    const unauthorizedLeave = await leavePOST(request("http://localhost/api/groups/1/leave", "POST"), {
      params: Promise.resolve({ groupId: String(groupId) }),
    });
    expect(unauthorizedLeave.status).toBe(401);

    const leaveMissingGroup = await leavePOST(request("http://localhost/api/groups/999/leave", "POST", undefined, token), {
      params: Promise.resolve({ groupId: "999" }),
    });
    expect(leaveMissingGroup.status).toBe(400);

    const badSettlementBody = await settlementsPOST(
      request("http://localhost/api/groups/1/settlements", "POST", { fromUserId: 1, toUserId: 3, amount: 1 }, token),
      { params: Promise.resolve({ groupId: String(groupId) }) },
    );
    expect(badSettlementBody.status).toBe(400);
  });

  it("validates expense detail routes", async () => {
    const token = await loginToken();

    const invalidGet = await expenseGET(request("http://localhost/api/groups/x/expenses/y", "GET", undefined, token), {
      params: Promise.resolve({ groupId: "x", expenseId: "y" }),
    });
    expect(invalidGet.status).toBe(400);

    const missingGroupGet = await expenseGET(request("http://localhost/api/groups/999/expenses/1", "GET", undefined, token), {
      params: Promise.resolve({ groupId: "999", expenseId: "1" }),
    });
    expect(missingGroupGet.status).toBe(404);

    const missingExpenseGet = await expenseGET(request("http://localhost/api/groups/1/expenses/999", "GET", undefined, token), {
      params: Promise.resolve({ groupId: "1", expenseId: "999" }),
    });
    expect(missingExpenseGet.status).toBe(404);

    const unauthPatch = await expensePATCH(
      request("http://localhost/api/groups/1/expenses/1", "PATCH", {
        title: "Rent",
        amount: 100,
        currency: "RON",
        category: "rent",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "equal",
        memberIds: [1],
        shares: [],
      }),
      { params: Promise.resolve({ groupId: "1", expenseId: "1" }) },
    );
    expect(unauthPatch.status).toBe(401);

    const badPatch = await expensePATCH(
      request("http://localhost/api/groups/x/expenses/y", "PATCH", {
        title: "Rent",
        amount: 100,
        currency: "RON",
        category: "rent",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "equal",
        memberIds: [1],
        shares: [],
      }, token),
      { params: Promise.resolve({ groupId: "x", expenseId: "y" }) },
    );
    expect(badPatch.status).toBe(400);

    const missingPatch = await expensePATCH(
      request("http://localhost/api/groups/1/expenses/999", "PATCH", {
        title: "Rent",
        amount: 100,
        currency: "RON",
        category: "rent",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "equal",
        memberIds: [1],
        shares: [],
      }, token),
      { params: Promise.resolve({ groupId: "1", expenseId: "999" }) },
    );
    expect(missingPatch.status).toBe(404);

    const badPatchBody = await expensePATCH(
      request("http://localhost/api/groups/1/expenses/1", "PATCH", { title: "x" }, token),
      { params: Promise.resolve({ groupId: "1", expenseId: "1" }) },
    );
    expect(badPatchBody.status).toBe(400);

    const unauthDelete = await expenseDELETE(
      request("http://localhost/api/groups/1/expenses/1", "DELETE"),
      { params: Promise.resolve({ groupId: "1", expenseId: "1" }) },
    );
    expect(unauthDelete.status).toBe(401);

    const badDelete = await expenseDELETE(
      request("http://localhost/api/groups/x/expenses/y", "DELETE", undefined, token),
      { params: Promise.resolve({ groupId: "x", expenseId: "y" }) },
    );
    expect(badDelete.status).toBe(400);

    const missingDelete = await expenseDELETE(
      request("http://localhost/api/groups/1/expenses/999", "DELETE", undefined, token),
      { params: Promise.resolve({ groupId: "1", expenseId: "999" }) },
    );
    expect(missingDelete.status).toBe(404);
  });

  it("rejects invalid group creation payloads", async () => {
    const token = await loginToken();
    const response = await groupsPOST(request("http://localhost/api/groups", "POST", { name: "A", category: "bad" }, token));
    expect(response.status).toBe(400);
  });
});
