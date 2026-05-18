import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("logHttpAction", () => {
  it("returns null when no current user", async () => {
    const getCurrentUserFromRequest = vi.fn().mockResolvedValueOnce(null);
    const createLog = vi.fn();
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ getCurrentUserFromRequest }));
    vi.doMock("@/lib/splitmates/services/logging-service", () => ({ createLog, LogOutcome: {} }));

    const { logHttpAction } = await import("@/lib/splitmates/api/http-action-log");
    const result = await logHttpAction({
      request: new Request("http://localhost"),
      actionType: "AUTH_LOGIN_SUCCESS" as any,
      outcome: "success" as any,
    });
    expect(result).toBeNull();
    expect(createLog).not.toHaveBeenCalled();
  });

  it("calls createLog with x-request-id header when present", async () => {
    const getCurrentUserFromRequest = vi.fn().mockResolvedValueOnce({ id: 1, roleId: 2 });
    const createLog = vi.fn().mockResolvedValueOnce({ id: 1 });
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ getCurrentUserFromRequest }));
    vi.doMock("@/lib/splitmates/services/logging-service", () => ({ createLog, LogOutcome: {} }));

    const { logHttpAction } = await import("@/lib/splitmates/api/http-action-log");
    await logHttpAction({
      request: new Request("http://localhost", { headers: { "x-request-id": "my-req-id-123" } }),
      actionType: "AUTH_LOGIN_SUCCESS" as any,
      outcome: "success" as any,
    });
    expect(createLog).toHaveBeenCalledWith(expect.objectContaining({
      requestId: "my-req-id-123",
      userId: 1,
    }));
  });

  it("calls createLog with x-forwarded-for IP", async () => {
    const getCurrentUserFromRequest = vi.fn().mockResolvedValueOnce({ id: 1, roleId: 2 });
    const createLog = vi.fn().mockResolvedValueOnce({});
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ getCurrentUserFromRequest }));
    vi.doMock("@/lib/splitmates/services/logging-service", () => ({ createLog, LogOutcome: {} }));

    const { logHttpAction } = await import("@/lib/splitmates/api/http-action-log");
    await logHttpAction({
      request: new Request("http://localhost", { headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" } }),
      actionType: "AUTH_LOGIN_SUCCESS" as any,
      outcome: "success" as any,
    });
    expect(createLog).toHaveBeenCalledWith(expect.objectContaining({ ip: "192.168.1.1" }));
  });

  it("calls createLog with x-real-ip when x-forwarded-for absent", async () => {
    const getCurrentUserFromRequest = vi.fn().mockResolvedValueOnce({ id: 1, roleId: 2 });
    const createLog = vi.fn().mockResolvedValueOnce({});
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ getCurrentUserFromRequest }));
    vi.doMock("@/lib/splitmates/services/logging-service", () => ({ createLog, LogOutcome: {} }));

    const { logHttpAction } = await import("@/lib/splitmates/api/http-action-log");
    await logHttpAction({
      request: new Request("http://localhost", { headers: { "x-real-ip": "10.10.0.5" } }),
      actionType: "AUTH_LOGIN_SUCCESS" as any,
      outcome: "success" as any,
    });
    expect(createLog).toHaveBeenCalledWith(expect.objectContaining({ ip: "10.10.0.5" }));
  });

  it("calls createLog with user-agent client info", async () => {
    const getCurrentUserFromRequest = vi.fn().mockResolvedValueOnce({ id: 1, roleId: 2 });
    const createLog = vi.fn().mockResolvedValueOnce({});
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ getCurrentUserFromRequest }));
    vi.doMock("@/lib/splitmates/services/logging-service", () => ({ createLog, LogOutcome: {} }));

    const { logHttpAction } = await import("@/lib/splitmates/api/http-action-log");
    await logHttpAction({
      request: new Request("http://localhost", { headers: { "user-agent": "Mozilla/5.0" } }),
      actionType: "AUTH_LOGIN_SUCCESS" as any,
      outcome: "success" as any,
    });
    expect(createLog).toHaveBeenCalledWith(expect.objectContaining({ clientInfo: "Mozilla/5.0" }));
  });

  it("passes groupId and actionJson to createLog", async () => {
    const getCurrentUserFromRequest = vi.fn().mockResolvedValueOnce({ id: 3, roleId: 1 });
    const createLog = vi.fn().mockResolvedValueOnce({});
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ getCurrentUserFromRequest }));
    vi.doMock("@/lib/splitmates/services/logging-service", () => ({ createLog, LogOutcome: {} }));

    const { logHttpAction } = await import("@/lib/splitmates/api/http-action-log");
    await logHttpAction({
      request: new Request("http://localhost"),
      actionType: "GROUP_EXPENSES_GET" as any,
      outcome: "success" as any,
      groupId: 7,
      actionJson: { page: 1 },
      fallbackUserId: 3,
    });
    expect(createLog).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 7,
      actionJson: { page: 1 },
    }));
  });

  it("returns null and does not throw when createLog throws", async () => {
    const getCurrentUserFromRequest = vi.fn().mockResolvedValueOnce({ id: 1, roleId: 2 });
    const createLog = vi.fn().mockRejectedValueOnce(new Error("DB error"));
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ getCurrentUserFromRequest }));
    vi.doMock("@/lib/splitmates/services/logging-service", () => ({ createLog, LogOutcome: {} }));

    const { logHttpAction } = await import("@/lib/splitmates/api/http-action-log");
    const result = await logHttpAction({
      request: new Request("http://localhost"),
      actionType: "AUTH_LOGIN_SUCCESS" as any,
      outcome: "success" as any,
    });
    expect(result).toBeNull();
  });
});
