import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  session: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
} as any;

vi.mock("@/lib/prisma", () => ({ prisma }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("session-service", () => {
  it("createSessionToken generates token with userId and timestamp", async () => {
    const { createSessionToken } = await import("@/lib/splitmates/services/auth/session-service");
    const token = createSessionToken(123);

    expect(token).toMatch(/^session-123-/);
    expect(token).toMatch(/\d{13}\d{4}$/);
  });

  it("readSessionTokenFromRequest reads from Authorization Bearer header", async () => {
    const { readSessionTokenFromRequest } = await import("@/lib/splitmates/services/auth/session-service");
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer my-token-123" },
    });

    const token = readSessionTokenFromRequest(request);
    expect(token).toBe("my-token-123");
  });

  it("readSessionTokenFromRequest reads from session cookie", async () => {
    const { readSessionTokenFromRequest } = await import("@/lib/splitmates/services/auth/session-service");
    const request = new Request("http://localhost", {
      headers: { Cookie: "splitmates_session=cookie-token-456" },
    });

    const token = readSessionTokenFromRequest(request);
    expect(token).toBe("cookie-token-456");
  });

  it("readSessionTokenFromRequest prefers Bearer header over cookie", async () => {
    const { readSessionTokenFromRequest } = await import("@/lib/splitmates/services/auth/session-service");
    const request = new Request("http://localhost", {
      headers: {
        Authorization: "Bearer header-token",
        Cookie: "splitmates_session=cookie-token",
      },
    });

    const token = readSessionTokenFromRequest(request);
    expect(token).toBe("header-token");
  });

  it("readSessionTokenFromRequest returns null when no token is provided", async () => {
    const { readSessionTokenFromRequest } = await import("@/lib/splitmates/services/auth/session-service");
    const request = new Request("http://localhost");

    const token = readSessionTokenFromRequest(request);
    expect(token).toBeNull();
  });

  it("revokeSessionToken updates session with revokedAt timestamp", async () => {
    const { revokeSessionToken } = await import("@/lib/splitmates/services/auth/session-service");

    await revokeSessionToken("my-token");

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { token: "my-token", revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it("revokeSessionToken does nothing if token is null or undefined", async () => {
    const { revokeSessionToken } = await import("@/lib/splitmates/services/auth/session-service");

    await revokeSessionToken(null);
    await revokeSessionToken(undefined);

    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });

  it("getUserBySessionToken returns user if session is valid", async () => {
    const mockUser = { id: 42, username: "alice", email: "alice@example.com" };
    prisma.session.findFirst.mockResolvedValueOnce({
      token: "valid-token",
      user: mockUser,
    });

    const { getUserBySessionToken } = await import("@/lib/splitmates/services/auth/session-service");
    const user = await getUserBySessionToken("valid-token");

    expect(user).toEqual(mockUser);
    expect(prisma.session.findFirst).toHaveBeenCalledWith({
      where: {
        token: "valid-token",
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      include: {
        user: true,
      },
    });
  });

  it("getUserBySessionToken returns null if token is invalid", async () => {
    prisma.session.findFirst.mockResolvedValueOnce(null);

    const { getUserBySessionToken } = await import("@/lib/splitmates/services/auth/session-service");
    const user = await getUserBySessionToken("invalid-token");

    expect(user).toBeNull();
  });

  it("getUserBySessionToken returns null if token is null or undefined", async () => {
    const { getUserBySessionToken } = await import("@/lib/splitmates/services/auth/session-service");

    expect(await getUserBySessionToken(null)).toBeNull();
    expect(await getUserBySessionToken(undefined)).toBeNull();
    expect(prisma.session.findFirst).not.toHaveBeenCalled();
  });

  it("getCurrentUserFromRequest returns user from valid session token", async () => {
    const mockUser = { id: 1, username: "alice" };
    prisma.session.findFirst.mockResolvedValueOnce({
      token: "valid-token",
      user: mockUser,
    });

    const { getCurrentUserFromRequest } = await import("@/lib/splitmates/services/auth/session-service");
    const request = new Request("http://localhost", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const user = await getCurrentUserFromRequest(request);

    expect(user).toEqual(mockUser);
  });

  it("getCurrentUserFromRequest uses fallbackUserId if session is invalid", async () => {
    const mockUser = { id: 99, username: "bob" };
    prisma.session.findFirst.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce(mockUser);

    const { getCurrentUserFromRequest } = await import("@/lib/splitmates/services/auth/session-service");
    const request = new Request("http://localhost");
    const user = await getCurrentUserFromRequest(request, 99);

    expect(user).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 99 },
    });
  });

  it("getCurrentUserFromRequest uses userId query parameter as fallback", async () => {
    const mockUser = { id: 7, username: "charlie" };
    prisma.session.findFirst.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce(mockUser);

    const { getCurrentUserFromRequest } = await import("@/lib/splitmates/services/auth/session-service");
    const request = new Request("http://localhost?userId=7");
    const user = await getCurrentUserFromRequest(request);

    expect(user).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
    });
  });

  it("getCurrentUserFromRequest returns null if no session and no fallback", async () => {
    prisma.session.findFirst.mockResolvedValueOnce(null);

    const { getCurrentUserFromRequest } = await import("@/lib/splitmates/services/auth/session-service");
    const request = new Request("http://localhost");
    const user = await getCurrentUserFromRequest(request);

    expect(user).toBeNull();
  });

  it("createSession creates a session in database", async () => {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    prisma.session.create.mockResolvedValueOnce({
      id: 1,
      userId: 5,
      token: "session-5-xxx",
      expiresAt,
    });

    const { createSession } = await import("@/lib/splitmates/services/auth/session-service");
    const result = await createSession(5);

    expect(result).toBeDefined();
    expect(result?.token).toMatch(/^session-5-/);
    expect(result?.expiresAt).toBeInstanceOf(Date);
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: {
        userId: 5,
        token: expect.stringContaining("session-5-"),
        expiresAt: expect.any(Date),
      },
    });
  });
});
