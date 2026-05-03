import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("auth and misc routes", () => {
  it("auth/login handles success, invalid creds, validation, and bad JSON", async () => {
    const loginUser = vi.fn();

    vi.doMock("@/lib/splitmates", () => ({ loginUser }));

    const mod = await import("@/app/api/auth/login/route");

    loginUser.mockResolvedValueOnce({ token: "t1", user: { id: 1, username: "raluca", email: "r@x", createdAt: "x" } });
    const okReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "raluca", password: "secret123" }),
    });
    const okRes = await mod.POST(okReq);
    expect(okRes.status).toBe(200);

    loginUser.mockRejectedValueOnce(new Error("Invalid login credentials."));
    const badCredReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "raluca", password: "wrongpass" }),
    });
    const badCredRes = await mod.POST(badCredReq);
    expect(badCredRes.status).toBe(401);

    const validationReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "x", password: "x" }),
    });
    const validationRes = await mod.POST(validationReq);
    expect(validationRes.status).toBe(400);

    const malformedReq = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const malformedRes = await mod.POST(malformedReq);
    expect(malformedRes.status).toBe(400);
  });

  it("auth/signup and logout cover success/error paths", async () => {
    const signupUser = vi.fn();
    const revokeSessionToken = vi.fn();

    vi.doMock("@/lib/splitmates", () => ({ signupUser }));
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({
      readSessionTokenFromRequest: () => "abc",
      revokeSessionToken,
      SESSION_COOKIE_NAME: "splitmates_session",
    }));

    const signupMod = await import("@/app/api/auth/signup/route");
    const logoutMod = await import("@/app/api/auth/logout/route");

    signupUser.mockResolvedValueOnce({ token: "t2", user: { id: 2, username: "ana", email: "a@x", createdAt: "x" } });
    const okReq = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "ana123", email: "ana@example.com", password: "secret123", confirmPassword: "secret123" }),
    });
    const okRes = await signupMod.POST(okReq);
    expect(okRes.status).toBe(201);

    const invalidReq = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "x", email: "bad", password: "1", confirmPassword: "2" }),
    });
    const invalidRes = await signupMod.POST(invalidReq);
    expect(invalidRes.status).toBe(400);

    const logoutRes = await logoutMod.POST(new Request("http://localhost/api/auth/logout", { method: "POST" }));
    expect(logoutRes.status).toBe(200);
    expect(revokeSessionToken).toHaveBeenCalledWith("abc");

    revokeSessionToken.mockImplementationOnce(() => { throw new Error("fail"); });
    const logoutErrRes = await logoutMod.POST(new Request("http://localhost/api/auth/logout", { method: "POST" }));
    expect(logoutErrRes.status).toBe(400);
  });

  it("dashboard route handles no users, success, and summary error", async () => {
    const getCurrentUserFromRequest = vi.fn();
    const getUsers = vi.fn();
    const getDashboardSummary = vi.fn();

    vi.doMock("@/lib/splitmates", () => ({
      getCurrentUserFromRequest,
      getUsers,
      getDashboardSummary,
    }));

    const mod = await import("@/app/api/dashboard/route");

    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    getUsers.mockResolvedValueOnce([]);
    const noUsers = await mod.GET(new Request("http://localhost/api/dashboard"));
    expect(noUsers.status).toBe(404);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    getDashboardSummary.mockResolvedValueOnce({ ok: true });
    const ok = await mod.GET(new Request("http://localhost/api/dashboard"));
    expect(ok.status).toBe(200);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    getDashboardSummary.mockRejectedValueOnce(new Error("boom"));
    const err = await mod.GET(new Request("http://localhost/api/dashboard"));
    expect(err.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    getDashboardSummary.mockRejectedValueOnce("boom");
    const nonError = await mod.GET(new Request("http://localhost/api/dashboard"));
    expect(nonError.status).toBe(400);
  });

  it("generator/health routes handle success and error branches", async () => {
    const startGenerator = vi.fn();
    const getGeneratorStatus = vi.fn();
    const stopGenerator = vi.fn();
    const getHealthSnapshot = vi.fn();

    vi.doMock("@/lib/splitmates", () => ({
      startGenerator,
      getGeneratorStatus,
      stopGenerator,
      getHealthSnapshot,
    }));

    const startMod = await import("@/app/api/generator/start/route");
    const statusMod = await import("@/app/api/generator/status/route");
    const stopMod = await import("@/app/api/generator/stop/route");
    const healthMod = await import("@/app/api/health/route");

    startGenerator.mockResolvedValueOnce({ running: true });
    const startOk = await startMod.POST(new Request("http://localhost/api/generator/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groupId: 1 }),
    }));
    expect(startOk.status).toBe(200);

    startGenerator.mockResolvedValueOnce({ running: true });
    const startMalformed = await startMod.POST(new Request("http://localhost/api/generator/start", {
      method: "POST",
      body: "{invalid",
    }));
    expect(startMalformed.status).toBe(200);

    startGenerator.mockRejectedValueOnce(new Error("bad group"));
    const startErr = await startMod.POST(new Request("http://localhost/api/generator/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groupId: 1 }),
    }));
    expect(startErr.status).toBe(400);

    getGeneratorStatus.mockReturnValueOnce({ running: false });
    const status = await statusMod.GET();
    expect(status.status).toBe(200);

    stopGenerator.mockReturnValueOnce({ running: false });
    const stop = await stopMod.POST();
    expect(stop.status).toBe(200);

    getHealthSnapshot.mockResolvedValueOnce({ users: 1, groups: 1, expenses: 0, payments: 0, generator: { running: false } });
    const health = await healthMod.GET();
    expect(health.status).toBe(200);
  });

  it("events route returns stream response", async () => {
    vi.useFakeTimers();

    const subscribeToEvents = vi.fn((listener: (p: unknown) => void) => {
      listener({ type: "evt", timestamp: new Date().toISOString(), data: { ok: true } });
      return () => {};
    });

    vi.doMock("@/lib/splitmates", () => ({ subscribeToEvents }));

    const mod = await import("@/app/api/events/route");
    const res = await mod.GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const reader = res.body!.getReader();
    const chunk = await reader.read();
    const text = new TextDecoder().decode(chunk.value);
    expect(text).toContain("retry");

    await reader.cancel();

    const origSetInterval = globalThis.setInterval;
    (globalThis as any).setInterval = () => null;
    const res2 = await mod.GET();
    await res2.body!.getReader().cancel();
    globalThis.setInterval = origSetInterval;

    vi.useRealTimers();
  });

  it("graphql route handles GET, missing query, malformed body, and simple login mutation", async () => {
    const loginUser = vi.fn().mockResolvedValue({ token: "tok", user: { id: 1, username: "raluca", email: "r@x", createdAt: "x" } });

    vi.doMock("@/lib/splitmates", () => ({
      addMemberToGroup: vi.fn(),
      createExpense: vi.fn(),
      createGroup: vi.fn(),
      createPayment: vi.fn(),
      deleteExpense: vi.fn(),
      deleteGroup: vi.fn(),
      getDashboardSummary: vi.fn().mockResolvedValue({ overall: {} }),
      getExpenseDetailForGroup: vi.fn().mockResolvedValue(null),
      getGeneratorStatus: vi.fn().mockReturnValue({ running: false, intervalMs: 1500, generatedCount: 0, groupId: null }),
      getGroupById: vi.fn().mockResolvedValue(null),
      getGroupStats: vi.fn().mockResolvedValue(null),
      getUserById: vi.fn().mockResolvedValue(null),
      getUsers: vi.fn().mockResolvedValue([]),
      leaveGroup: vi.fn(),
      getExpenses: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 5, totalItems: 0, totalPages: 1 }),
      getGroups: vi.fn().mockResolvedValue([]),
      getPayments: vi.fn().mockResolvedValue([]),
      loginUser,
      removeMemberFromGroup: vi.fn(),
      signupUser: vi.fn(),
      getCurrentUserFromRequest: vi.fn().mockResolvedValue(null),
      startGenerator: vi.fn().mockResolvedValue({ running: false }),
      stopGenerator: vi.fn().mockReturnValue({ running: false }),
      updateExpense: vi.fn(),
      updateGroup: vi.fn(),
    }));

    vi.doMock("@/lib/splitmates/api/group-response", () => ({
      mapGroupForResponse: vi.fn().mockResolvedValue(null),
    }));

    const mod = await import("@/app/api/graphql/route");

    const getRes = await mod.GET();
    expect(getRes.status).toBe(200);

    const missing = await mod.POST(new Request("http://localhost/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variables: {} }),
    }));
    expect(missing.status).toBe(400);

    const malformed = await mod.POST(new Request("http://localhost/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    }));
    expect(malformed.status).toBe(400);

    const gqlRes = await mod.POST(new Request("http://localhost/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `mutation($identifier:String!,$password:String!){login(identifier:$identifier,password:$password){token user{id username}}}`,
        variables: { identifier: "raluca", password: "secret123" },
      }),
    }));
    expect(gqlRes.status).toBe(200);
    expect(loginUser).toHaveBeenCalledOnce();
  });
});