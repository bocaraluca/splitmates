import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogOutcome, SuspiciousStatus } from "@prisma/client";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("admin logs and suspicious routes", () => {
  it("admin logs route handles auth, filters, and success", async () => {
    const getCurrentUserFromRequest = vi.fn();
    const requirePermission = vi.fn();
    const getLogs = vi.fn();
    const logHttpAction = vi.fn();

    vi.doMock("@/lib/splitmates", () => ({ getCurrentUserFromRequest }));
    vi.doMock("@/lib/splitmates/services/auth/permissions-service", () => ({ requirePermission }));
    vi.doMock("@/lib/splitmates/services/logging-service", () => ({
      getLogs,
      LogOutcome,
    }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction }));

    const mod = await import("@/app/api/admin/logs/route");

    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const unauthorized = await mod.GET(new Request("http://localhost/api/admin/logs"));
    expect(unauthorized.status).toBe(401);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockResolvedValueOnce(undefined);
    getLogs.mockResolvedValueOnce({
      items: [
        {
          id: 1n,
          userId: 7,
          user: { username: "ana", email: "ana@example.com" },
          groupId: 3,
          roleId: null,
          roleTitle: null,
          actionType: "AUTH_LOGIN_SUCCESS",
          actionJson: { ok: true },
          ip: "127.0.0.1",
          clientInfo: "browser",
          requestId: "req-1",
          outcome: LogOutcome.success,
          createdAt: new Date("2026-05-06T10:00:00.000Z"),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });

    const ok = await mod.GET(
      new Request(
        "http://localhost/api/admin/logs?userId=7&user=ana&actionType=AUTH_LOGIN_SUCCESS&outcome=success&from=2026-05-01T00:00:00.000Z&to=2026-05-07T00:00:00.000Z&page=1&pageSize=50",
      ),
    );
    expect(ok.status).toBe(200);
    const payload = await ok.json();
    expect(payload.logs).toEqual([
      expect.objectContaining({
        id: "1",
        userId: 7,
        user: { username: "ana", email: "ana@example.com" },
        actionType: "AUTH_LOGIN_SUCCESS",
        outcome: LogOutcome.success,
      }),
    ]);
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        user: "ana",
        actionType: "AUTH_LOGIN_SUCCESS",
        outcome: LogOutcome.success,
      }),
      expect.objectContaining({ page: 1, pageSize: 50 }),
    );
  });

  it("admin logs route rejects invalid filters and permission errors", async () => {
    const getCurrentUserFromRequest = vi.fn();
    const requirePermission = vi.fn();
    const getLogs = vi.fn();
    const logHttpAction = vi.fn();

    vi.doMock("@/lib/splitmates", () => ({ getCurrentUserFromRequest }));
    vi.doMock("@/lib/splitmates/services/auth/permissions-service", () => ({ requirePermission }));
    vi.doMock("@/lib/splitmates/services/logging-service", () => ({
      getLogs,
      LogOutcome,
    }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction }));

    const mod = await import("@/app/api/admin/logs/route");

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockRejectedValueOnce(Object.assign(new Error("Nope"), { status: 403 }));
    const denied = await mod.GET(new Request("http://localhost/api/admin/logs?userId=7"));
    expect(denied.status).toBe(403);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockResolvedValueOnce(undefined);
    const invalidUserId = await mod.GET(new Request("http://localhost/api/admin/logs?userId=abc"));
    expect(invalidUserId.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockResolvedValueOnce(undefined);
    const invalidOutcome = await mod.GET(new Request("http://localhost/api/admin/logs?userId=7&outcome=bad"));
    expect(invalidOutcome.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockResolvedValueOnce(undefined);
    const invalidDate = await mod.GET(new Request("http://localhost/api/admin/logs?userId=7&from=bad-date"));
    expect(invalidDate.status).toBe(400);
  });

  it("admin suspicious routes handle auth, list, and patch states", async () => {
    const getCurrentUserFromRequest = vi.fn();
    const requirePermission = vi.fn();
    const loadSuspiciousUsers = vi.fn();
    const clearSuspiciousUser = vi.fn();
    const logHttpAction = vi.fn();
    const prisma = {
      suspiciousUser: {
        upsert: vi.fn(),
      },
    } as any;

    vi.doMock("@/lib/splitmates", () => ({ getCurrentUserFromRequest }));
    vi.doMock("@/lib/splitmates/services/auth/permissions-service", () => ({ requirePermission }));
    vi.doMock("@/lib/splitmates/services/suspicious-user-service", () => ({
      loadSuspiciousUsers,
      clearSuspiciousUser,
    }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction }));
    vi.doMock("@/lib/prisma", () => ({ prisma }));

    const listMod = await import("@/app/api/admin/suspicious/route");
    const patchMod = await import("@/app/api/admin/suspicious/[userId]/route");

    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const unauthorized = await listMod.GET(new Request("http://localhost/api/admin/suspicious"));
    expect(unauthorized.status).toBe(401);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockRejectedValueOnce(Object.assign(new Error("Nope"), { status: 403 }));
    const forbidden = await listMod.GET(new Request("http://localhost/api/admin/suspicious"));
    expect(forbidden.status).toBe(403);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockResolvedValueOnce(undefined);
    loadSuspiciousUsers.mockResolvedValueOnce([
      {
        userId: 7,
        reason: "Repeated failures",
        lastSeen: new Date("2026-05-06T10:00:00.000Z"),
        user: { username: "ana", email: "ana@example.com" },
        observations: [
          {
            note: "5 events in the last 5 minutes",
            createdAt: new Date("2026-05-06T10:00:00.000Z"),
            rule: { key: "multiple_failed_logins" },
          },
        ],
      },
    ]);
    const ok = await listMod.GET(new Request("http://localhost/api/admin/suspicious"));
    expect(ok.status).toBe(200);
    const payload = await ok.json();
    expect(payload.suspiciousUsers).toEqual([
      expect.objectContaining({
        userId: 7,
        reason: "Repeated failures",
        user: { username: "ana", email: "ana@example.com" },
        observations: [
          expect.objectContaining({
            ruleKey: "multiple_failed_logins",
            note: "5 events in the last 5 minutes",
          }),
        ],
      }),
    ]);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockResolvedValueOnce(undefined);
    const invalidId = await patchMod.PATCH(
      new Request("http://localhost/api/admin/suspicious/abc", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cleared" }),
      }),
      { params: Promise.resolve({ userId: "abc" }) },
    );
    expect(invalidId.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockResolvedValueOnce(undefined);
    const invalidStatus = await patchMod.PATCH(
      new Request("http://localhost/api/admin/suspicious/7", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "watching" }),
      }),
      { params: Promise.resolve({ userId: "7" }) },
    );
    expect(invalidStatus.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockResolvedValueOnce(undefined);
    clearSuspiciousUser.mockResolvedValueOnce({
      userId: 7,
      status: SuspiciousStatus.cleared,
      reason: null,
      lastSeen: new Date("2026-05-06T10:00:00.000Z"),
    });
    const cleared = await patchMod.PATCH(
      new Request("http://localhost/api/admin/suspicious/7", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cleared" }),
      }),
      { params: Promise.resolve({ userId: "7" }) },
    );
    expect(cleared.status).toBe(200);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockResolvedValueOnce(undefined);
    prisma.suspiciousUser.upsert.mockResolvedValueOnce({
      userId: 7,
      status: SuspiciousStatus.underReview,
      reason: null,
      lastSeen: new Date("2026-05-06T10:00:00.000Z"),
    });
    const underReview = await patchMod.PATCH(
      new Request("http://localhost/api/admin/suspicious/7", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "underReview" }),
      }),
      { params: Promise.resolve({ userId: "7" }) },
    );
    expect(underReview.status).toBe(200);
  });
});
