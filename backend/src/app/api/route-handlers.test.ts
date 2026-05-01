import { beforeEach, describe, expect, it } from "vitest";
import { POST as loginPOST } from "./auth/login/route";
import { POST as signupPOST } from "./auth/signup/route";
import { GET as dashboardGET } from "./dashboard/route";
import { GET as eventsGET } from "./events/route";
import { GET as healthGET } from "./health/route";
import { POST as generatorStartPOST } from "./generator/start/route";
import { GET as generatorStatusGET } from "./generator/status/route";
import { POST as generatorStopPOST } from "./generator/stop/route";
import { GET as groupsGET, POST as groupsPOST } from "./groups/route";
import { DELETE as groupDELETE, GET as groupGET, PATCH as groupPATCH } from "./groups/[groupId]/route";
import { DELETE as memberDELETE, POST as memberPOST } from "./groups/[groupId]/members/route";
import { POST as leavePOST } from "./groups/[groupId]/leave/route";
import { GET as expensesGET, POST as expensesPOST } from "./groups/[groupId]/expenses/route";
import { DELETE as expenseDELETE, GET as expenseGET, PATCH as expensePATCH } from "./groups/[groupId]/expenses/[expenseId]/route";
import { GET as statsGET } from "./groups/[groupId]/stats/route";
import { GET as settlementsGET, POST as settlementsPOST } from "./groups/[groupId]/settlements/route";
import { getUserRecordByIdentifier, resetSplitmatesStateForTests } from "@/lib/splitmates";

beforeEach(() => {
  resetSplitmatesStateForTests();
});

function jsonRequest(url: string, body?: unknown, token?: string) {
  return new Request(url, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("route handlers", () => {
  it("exposes health, auth, dashboard and generator endpoints", async () => {
    const health = await healthGET();
    expect((await readJson(health)).ok).toBe(true);

    const signedUp = await signupPOST(
      jsonRequest("http://localhost/api/auth/signup", {
        username: "maria",
        email: "maria@example.com",
        password: "secret123",
        confirmPassword: "secret123",
      }),
    );
    expect(signedUp.status).toBe(201);

    const login = await loginPOST(
      jsonRequest("http://localhost/api/auth/login", {
        identifier: "maria",
        password: "secret123",
      }),
    );
    const loginBody = await readJson(login);
    expect(loginBody.token).toBeTruthy();

    const dashboard = await dashboardGET(jsonRequest("http://localhost/api/dashboard", undefined, String(loginBody.token)));
    expect(dashboard.status).toBe(200);

    const start = await generatorStartPOST(
      jsonRequest("http://localhost/api/generator/start", { groupId: undefined }),
    );
    expect(start.status).toBe(200);

    const status = await generatorStatusGET();
    expect((await readJson(status)).status).toBeTruthy();

    const stop = await generatorStopPOST();
    expect(stop.status).toBe(200);
  });

  it("supports groups, expenses, stats, settlements and event streams", async () => {
    const primaryUser = getUserRecordByIdentifier("raluca")!;
    const secondaryUser = getUserRecordByIdentifier("ana")!;

    const login = await loginPOST(
      jsonRequest("http://localhost/api/auth/login", {
        identifier: primaryUser.username,
        password: "raluca",
      }),
    );
    const loginBody = await readJson(login);
    const token = String(loginBody.token);

    const createdGroup = await groupsPOST(
      jsonRequest("http://localhost/api/groups", { name: "Test Group", category: "household" }, token),
    );
    const createdGroupBody = await readJson(createdGroup);
    const group = createdGroupBody.group as { id: number };

    const groupList = await groupsGET(jsonRequest("http://localhost/api/groups", undefined, token));
    expect((await readJson(groupList)).groups).toBeTruthy();

    const groupDetail = await groupGET(jsonRequest(`http://localhost/api/groups/${group.id}`, undefined, token), {
      params: Promise.resolve({ groupId: String(group.id) }),
    });
    expect(groupDetail.status).toBe(200);

    const groupPatch = await groupPATCH(
      jsonRequest(`http://localhost/api/groups/${group.id}`, { name: "Updated Group" }, token),
      { params: Promise.resolve({ groupId: String(group.id) }) },
    );
    expect(groupPatch.status).toBe(200);

    const memberAdd = await memberPOST(
      jsonRequest(`http://localhost/api/groups/${group.id}/members`, { identifier: "ana" }, token),
      { params: Promise.resolve({ groupId: String(group.id) }) },
    );
    expect(memberAdd.status).toBe(200);

    const expenseCreate = await expensesPOST(
      jsonRequest(`http://localhost/api/groups/${group.id}/expenses`, {
        title: "Internet",
        amount: 100,
        currency: "RON",
        category: "utilities",
        date: new Date().toISOString(),
        paidByUserId: primaryUser.id,
        splitType: "equal",
        memberIds: [primaryUser.id, secondaryUser.id],
        shares: [],
      }, token),
      { params: Promise.resolve({ groupId: String(group.id) }) },
    );
    expect(expenseCreate.status).toBe(201);
    const expenseBody = await readJson(expenseCreate);
    const expense = expenseBody.expense as { id: number };

    const expenseList = await expensesGET(jsonRequest(`http://localhost/api/groups/${group.id}/expenses?page=1&pageSize=5`, undefined, token), {
      params: Promise.resolve({ groupId: String(group.id) }),
    });
    expect(expenseList.status).toBe(200);

    const expenseDetail = await expenseGET(
      jsonRequest(`http://localhost/api/groups/${group.id}/expenses/${expense.id}`, undefined, token),
      { params: Promise.resolve({ groupId: String(group.id), expenseId: String(expense.id) }) },
    );
    expect(expenseDetail.status).toBe(200);

    const expensePatch = await expensePATCH(
      jsonRequest(`http://localhost/api/groups/${group.id}/expenses/${expense.id}`, {
        title: "Internet",
        amount: 110,
        currency: "RON",
        category: "utilities",
        date: new Date().toISOString(),
        paidByUserId: primaryUser.id,
        splitType: "equal",
        memberIds: [primaryUser.id, secondaryUser.id],
        shares: [],
      }, token),
      { params: Promise.resolve({ groupId: String(group.id), expenseId: String(expense.id) }) },
    );
    expect(expensePatch.status).toBe(200);

    const stats = await statsGET(jsonRequest(`http://localhost/api/groups/${group.id}/stats`, undefined, token), {
      params: Promise.resolve({ groupId: String(group.id) }),
    });
    expect(stats.status).toBe(200);

    const settlement = await settlementsPOST(
      jsonRequest(`http://localhost/api/groups/${group.id}/settlements`, {
        fromUserId: secondaryUser.id,
        toUserId: primaryUser.id,
        amount: 10,
      }, token),
      { params: Promise.resolve({ groupId: String(group.id) }) },
    );
    expect(settlement.status).toBeGreaterThanOrEqual(200);

    const settlementsList = await settlementsGET(jsonRequest(`http://localhost/api/groups/${group.id}/settlements`, undefined, token), {
      params: Promise.resolve({ groupId: String(group.id) }),
    });
    expect(settlementsList.status).toBe(200);

    const memberDelete = await memberDELETE(
      jsonRequest(`http://localhost/api/groups/${group.id}/members`, { identifier: "ana" }, token),
      { params: Promise.resolve({ groupId: String(group.id) }) },
    );
    expect(memberDelete.status).toBe(200);

    const expenseDelete = await expenseDELETE(
      jsonRequest(`http://localhost/api/groups/${group.id}/expenses/${expense.id}`, undefined, token),
      { params: Promise.resolve({ groupId: String(group.id), expenseId: String(expense.id) }) },
    );
    expect(expenseDelete.status).toBe(200);

    const leave = await leavePOST(jsonRequest(`http://localhost/api/groups/${group.id}/leave`, undefined, token), {
      params: Promise.resolve({ groupId: String(group.id) }),
    });
    expect(leave.status).toBe(200);

    const stream = await eventsGET();
    expect(stream.headers.get("content-type")).toContain("text/event-stream");

  });

  it("deletes a group through the route handler", async () => {
    const login = await loginPOST(
      jsonRequest("http://localhost/api/auth/login", {
        identifier: "raluca",
        password: "raluca",
      }),
    );
    const loginBody = await readJson(login);
    const token = String(loginBody.token);

    const createdGroup = await groupsPOST(
      jsonRequest("http://localhost/api/groups", { name: "Disposable Group", category: "friends" }, token),
    );
    const createdGroupBody = await readJson(createdGroup);
    const group = createdGroupBody.group as { id: number };

    const groupDelete = await groupDELETE(jsonRequest(`http://localhost/api/groups/${group.id}`, undefined, token), {
      params: Promise.resolve({ groupId: String(group.id) }),
    });

    expect(groupDelete.status).toBe(200);
  });
});
