import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError, ZodIssueCode } from "zod";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    group: {
      count: vi.fn(),
    },
    expense: {
      count: vi.fn(),
    },
    payment: {
      count: vi.fn(),
    },
    session: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { mapGroupForResponse } from "@/lib/splitmates/api/group-response";
import { jsonClearSession, jsonError, jsonOk, jsonSessionOk } from "@/lib/splitmates/api/http";
import { emitEvent, subscribeToEvents } from "@/lib/splitmates/core/events";
import { buildEqualShares, normalizeShares, roundMoney, sortExpenses } from "@/lib/splitmates/core/math";
import { getState, resetSplitmatesStateForTests } from "@/lib/splitmates/core/state";
import { formatValidationError } from "@/lib/splitmates/validation/errors";
import { expenseSchema, generatorSchema, loginSchema, paginationSchema, paymentSchema, signupSchema } from "@/lib/splitmates/validation/schemas";
import {
  createSession,
  createSessionToken,
  getCurrentUserFromRequest,
  getUserBySessionToken,
  readSessionTokenFromRequest,
  revokeSessionToken,
} from "@/lib/splitmates/services/auth/session-service";
import { getHealthSnapshot } from "@/lib/splitmates/services/generator/health-service";

beforeEach(() => {
  vi.clearAllMocks();
  resetSplitmatesStateForTests();
  delete (globalThis as any).__splitmatesBroadcastWebSocket;
});

describe("utility coverage", () => {
  it("formats validation and generic errors", () => {
    const zodError = new ZodError([
      { code: "custom", message: "Wrong value", path: ["field"] },
    ] as any);

    expect(formatValidationError(zodError, "fallback")).toBe("Field: Wrong value");
    expect(formatValidationError(new Error("Boom"), "fallback")).toBe("Boom");
    expect(formatValidationError("x", "fallback")).toBe("fallback");
  });

  it("validates schemas for success and failure branches", () => {
    expect(() =>
      signupSchema.parse({
        username: "user123",
        email: "user@example.com",
        password: "secret123",
        confirmPassword: "secret123",
      }),
    ).not.toThrow();

    expect(() =>
      signupSchema.parse({
        username: "u",
        email: "bad",
        password: "1",
        confirmPassword: "2",
      }),
    ).toThrow();

    expect(loginSchema.parse({ identifier: "someone", password: "secret123" }).identifier).toBe("someone");
    expect(() => paginationSchema.parse({ pageSize: 8 })).toThrow("pageSize must be 5, 10, or 20.");
    expect(paymentSchema.parse({ fromUserId: 1, toUserId: 2, amount: 10 }).amount).toBe(10);
    expect(() => paymentSchema.parse({ fromUserId: 1, toUserId: 1, amount: 10 })).toThrow();

    expect(() =>
      expenseSchema.parse({
        title: "Rent",
        amount: 100,
        currency: "RON",
        category: "rent",
        date: new Date().toISOString(),
        paidByUserId: 1,
        splitType: "equal",
        memberIds: [],
        shares: [],
      }),
    ).toThrow("At least one member is required for equal split.");

    expect(generatorSchema.parse({}).groupId).toBeUndefined();
  });

  it("covers math helpers", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(buildEqualShares(50, [])).toEqual([]);
    expect(buildEqualShares(100, [1, 2, 3]).reduce((sum, s) => sum + s.amount, 0)).toBeCloseTo(100, 2);
    expect(normalizeShares([{ userId: 1, amount: 5 }, { userId: 1, amount: 7 }])[0].amount).toBe(12);

    const items = [
      { amount: 3, date: "2026-01-02" },
      { amount: 10, date: "2026-01-01" },
    ];
    expect(sortExpenses(items, "amount", "asc")[0].amount).toBe(3);
    expect(sortExpenses(items, "amount", "desc")[0].amount).toBe(10);
    expect(sortExpenses(items, "date", "asc")[0].date).toBe("2026-01-01");
  });

  it("covers event subscribe/unsubscribe and websocket bridge", () => {
    const wsSpy = vi.fn();
    (globalThis as any).__splitmatesBroadcastWebSocket = wsSpy;

    const listener = vi.fn();
    const unsubscribe = subscribeToEvents(listener);

    emitEvent("x.test", { ok: true });
    expect(listener).toHaveBeenCalledOnce();
    expect(wsSpy).toHaveBeenCalledOnce();

    unsubscribe();
    emitEvent("x.test2", { ok: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("maps group response and handles missing users", async () => {
    (prisma.user.findMany as any).mockResolvedValue([
      { id: 1, username: "raluca", email: "raluca@example.com", createdAt: new Date("2026-01-01") },
    ]);

    const mapped = await mapGroupForResponse(
      {
        id: 10,
        name: "G",
        category: "household",
        createdAt: new Date(),
        memberIds: [1, 2],
        adminIds: [1],
      },
      1,
    );

    expect(mapped.members[0]?.username).toBe("raluca");
    expect(mapped.members[1]).toBeNull();
    expect(mapped.isMember).toBe(true);
    expect(mapped.isAdmin).toBe(true);
  });

  it("covers HTTP helper responses and cookies", async () => {
    const ok = jsonOk({ ok: true }, 201);
    expect(ok.status).toBe(201);
    await expect(ok.json()).resolves.toEqual({ ok: true });

    const err = jsonError("Nope", 418);
    expect(err.status).toBe(418);

    const session = jsonSessionOk({ token: "x" }, "token-value");
    expect(session.cookies.get("splitmates_session")?.value).toBe("token-value");

    const cleared = jsonClearSession();
    expect(cleared.cookies.get("splitmates_session")?.maxAge).toBe(0);
  });

  it("covers session-service token parsing and db branches", async () => {
    const token = createSessionToken(7);
    expect(token).toMatch(/^session-7-/);

    const bearerReq = new Request("http://localhost", {
      headers: { authorization: "Bearer abc123" },
    });
    expect(readSessionTokenFromRequest(bearerReq)).toBe("abc123");

    const cookieReq = new Request("http://localhost", {
      headers: { cookie: "foo=bar; splitmates_session=my%20token" },
    });
    expect(readSessionTokenFromRequest(cookieReq)).toBe("my token");

    const irrelevantCookieReq = new Request("http://localhost", {
      headers: { cookie: "some_other_cookie=token123" },
    });
    expect(readSessionTokenFromRequest(irrelevantCookieReq)).toBeNull();

    await revokeSessionToken(null);
    expect(prisma.session.updateMany).not.toHaveBeenCalled();

    await revokeSessionToken("abc");
    expect(prisma.session.updateMany).toHaveBeenCalledOnce();

    expect(await getUserBySessionToken(undefined)).toBeNull();

    (prisma.session.findFirst as any).mockResolvedValueOnce(null);
    expect(await getUserBySessionToken("missing")).toBeNull();

    (prisma.session.findFirst as any).mockResolvedValueOnce({ user: { id: 1, username: "raluca" } });
    await expect(getUserBySessionToken("found")).resolves.toEqual({ id: 1, username: "raluca" });

    const validSessionReq = new Request("http://localhost", {
      headers: { authorization: "Bearer valid_token" },
    });
    (prisma.session.findFirst as any).mockResolvedValueOnce({ user: { id: 10, username: "session_user" } });
    await expect(getCurrentUserFromRequest(validSessionReq)).resolves.toEqual({ id: 10, username: "session_user" });

    (prisma.session.create as any).mockResolvedValue({});
    const created = await createSession(3);
    expect(created.token).toMatch(/^session-3-/);
    expect(prisma.session.create).toHaveBeenCalledOnce();

    (prisma.user.findUnique as any).mockResolvedValue({ id: 42, username: "ana" });
    const fallbackReq = new Request("http://localhost/path");
    await expect(getCurrentUserFromRequest(fallbackReq, 42)).resolves.toEqual({ id: 42, username: "ana" });

    const queryReq = new Request("http://localhost/path?userId=77");
    await getCurrentUserFromRequest(queryReq);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 77 } });

    const completelyEmptyReq = new Request("http://localhost/path");
    await expect(getCurrentUserFromRequest(completelyEmptyReq)).resolves.toBeNull();
  });

  it("covers state and health snapshot", async () => {
    const state = getState();
    state.generator.running = true;
    state.generator.generatedCount = 3;
    state.generator.groupId = 9;

    (prisma.user.count as any).mockResolvedValue(5);
    (prisma.group.count as any).mockResolvedValue(2);
    (prisma.expense.count as any).mockResolvedValue(11);
    (prisma.payment.count as any).mockResolvedValue(4);

    const health = await getHealthSnapshot();
    expect(health.users).toBe(5);
    expect(health.groups).toBe(2);
    expect(health.generator.running).toBe(true);
    expect(health.generator.generatedCount).toBe(3);
  });

  it("covers state reset timer cleanup branch", () => {
    const state = getState();
    const interval = setInterval(() => undefined, 1000);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    state.generator.timer = interval;
    resetSplitmatesStateForTests();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});

describe("formatValidationError", () => {
  it("formats a ZodError with a valid string field name", () => {
    const zodError = new ZodError([
      {
        code: ZodIssueCode.custom,
        path: ["email"],
        message: "Enter a valid email address.",
      },
    ]);

    const result = formatValidationError(zodError, "Fallback error");
    expect(result).toBe("Email: Enter a valid email address.");
  });

  it("formats a ZodError without a string path", () => {
    const zodError = new ZodError([
      {
        code: ZodIssueCode.custom,
        path: [0], 
        message: "Invalid item in array.",
      },
    ]);

    const result = formatValidationError(zodError, "Fallback error");
    expect(result).toBe("Invalid item in array.");
  });

  it("returns the standard error message for normal errors", () => {
    const standardError = new Error("Something went wrong!");
    const result = formatValidationError(standardError, "Fallback error");
    
    expect(result).toBe("Something went wrong!");
  });

  it("returns the fallback message for unknown error types", () => {
    const unknownError = { foo: "bar" }; 
    const result = formatValidationError(unknownError, "Fallback error");
    
    expect(result).toBe("Fallback error");
  });
});