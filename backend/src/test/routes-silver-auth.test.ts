import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("forgot-password route", () => {
  it("returns 200 with success message when user exists", async () => {
    const createPasswordResetToken = vi.fn().mockResolvedValueOnce({ token: "tok", userId: 1 });
    vi.doMock("@/lib/splitmates/services/auth/reset-password-service", () => ({ createPasswordResetToken }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe("A password reset link has been sent to your email.");
  });

  it("returns 200 with generic message when user not found", async () => {
    const createPasswordResetToken = vi.fn().mockResolvedValueOnce(null);
    vi.doMock("@/lib/splitmates/services/auth/reset-password-service", () => ({ createPasswordResetToken }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ghost@example.com" }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).message).toContain("If an account");
  });

  it("returns 400 on invalid email", async () => {
    vi.doMock("@/lib/splitmates/services/auth/reset-password-service", () => ({ createPasswordResetToken: vi.fn() }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on bad JSON", async () => {
    vi.doMock("@/lib/splitmates/services/auth/reset-password-service", () => ({ createPasswordResetToken: vi.fn() }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/forgot-password/route");
    const res = await POST(new Request("http://localhost", { method: "POST", body: "{bad" }));
    expect(res.status).toBe(400);
  });
});

describe("reset-password route", () => {
  it("returns 200 on valid token", async () => {
    const prisma = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: 1, token: "t", userId: 1, usedAt: null,
          expiresAt: new Date(Date.now() + 3600000),
        }),
        update: vi.fn(),
      },
      user: { update: vi.fn() },
      $transaction: vi.fn().mockResolvedValueOnce([]),
    };
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "t", password: "newpass123", confirmPassword: "newpass123" }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).message).toContain("reset successfully");
  });

  it("returns 400 when token not found", async () => {
    const prisma = { passwordResetToken: { findUnique: vi.fn().mockResolvedValueOnce(null) } };
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "bad", password: "newpass123", confirmPassword: "newpass123" }),
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid or expired token.");
  });

  it("returns 400 when token already used", async () => {
    const prisma = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: 1, token: "t", userId: 1,
          usedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
        }),
      },
    };
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "t", password: "newpass123", confirmPassword: "newpass123" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token expired", async () => {
    const prisma = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: 1, token: "t", userId: 1,
          usedAt: null,
          expiresAt: new Date(Date.now() - 1000),
        }),
      },
    };
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "t", password: "newpass123", confirmPassword: "newpass123" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on validation error", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: { passwordResetToken: { findUnique: vi.fn() } } }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "t", password: "123", confirmPassword: "123" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on bad JSON", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: { passwordResetToken: { findUnique: vi.fn() } } }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(new Request("http://localhost", { method: "POST", body: "{bad" }));
    expect(res.status).toBe(400);
  });
});

describe("magic-link route", () => {
  it("returns 200 when email is valid", async () => {
    const createMagicLink = vi.fn().mockResolvedValueOnce({ userId: 1 });
    vi.doMock("@/lib/splitmates/services/auth/magic-link-service", () => ({ createMagicLink }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/magic-link/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).message).toContain("login link");
  });

  it("returns 200 when user is new (userId null)", async () => {
    const createMagicLink = vi.fn().mockResolvedValueOnce({ userId: null });
    vi.doMock("@/lib/splitmates/services/auth/magic-link-service", () => ({ createMagicLink }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/magic-link/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new@example.com" }),
    }));
    expect(res.status).toBe(200);
  });

  it("returns 400 on invalid email", async () => {
    vi.doMock("@/lib/splitmates/services/auth/magic-link-service", () => ({ createMagicLink: vi.fn() }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/magic-link/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-valid" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on bad JSON", async () => {
    vi.doMock("@/lib/splitmates/services/auth/magic-link-service", () => ({ createMagicLink: vi.fn() }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/magic-link/route");
    const res = await POST(new Request("http://localhost", { method: "POST", body: "{bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when service throws", async () => {
    const createMagicLink = vi.fn().mockRejectedValueOnce(new Error("SMTP failed"));
    vi.doMock("@/lib/splitmates/services/auth/magic-link-service", () => ({ createMagicLink }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/magic-link/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    }));
    expect(res.status).toBe(400);
  });
});

describe("magic-link/verify route", () => {
  it("returns 200 with session on valid token", async () => {
    const user = { id: 5, username: "alice", email: "alice@x.com", createdAt: new Date(), roleId: 2 };
    const verifyMagicLink = vi.fn().mockResolvedValueOnce(user);
    const createSession = vi.fn().mockResolvedValueOnce({ token: "sess-tok" });
    const prisma = {
      role: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: 2, title: "user",
          rolePermissions: [{ permission: { title: "Create groups" } }],
        }),
      },
    };
    vi.doMock("@/lib/splitmates/services/auth/magic-link-service", () => ({ verifyMagicLink }));
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ createSession, SESSION_COOKIE_NAME: "splitmates_session" }));
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/magic-link/verify/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "valid-tok" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe("sess-tok");
    expect(body.user.username).toBe("alice");
    expect(body.permissions).toContain("Create groups");
  });

  it("returns 400 on invalid token", async () => {
    const verifyMagicLink = vi.fn().mockResolvedValueOnce(null);
    vi.doMock("@/lib/splitmates/services/auth/magic-link-service", () => ({ verifyMagicLink }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/magic-link/verify/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "bad-token" }),
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid or expired magic link.");
  });

  it("returns 400 on bad JSON", async () => {
    vi.doMock("@/lib/splitmates/services/auth/magic-link-service", () => ({ verifyMagicLink: vi.fn() }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/magic-link/verify/route");
    const res = await POST(new Request("http://localhost", { method: "POST", body: "{bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on generic error from verifyMagicLink", async () => {
    const verifyMagicLink = vi.fn().mockRejectedValueOnce(new Error("db down"));
    vi.doMock("@/lib/splitmates/services/auth/magic-link-service", () => ({ verifyMagicLink }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { POST } = await import("@/app/api/auth/magic-link/verify/route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "tok" }),
    }));
    expect(res.status).toBe(400);
  });
});

describe("google route", () => {
  it("GET redirects to Google OAuth URL with correct params", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:4000/redirect";

    const { GET } = await import("@/app/api/auth/google/route");
    const res = await GET();
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("accounts.google.com");
    expect(res.headers.get("Location")).toContain("test-client-id");
    expect(res.headers.get("Location")).toContain("openid");
  });
});

describe("google/redirect route", () => {
  it("redirects to error when code is missing", async () => {
    process.env.FRONTEND_URL = "http://localhost:3000";
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));

    const { GET } = await import("@/app/api/auth/google/redirect/route");
    const res = await GET(new Request("http://localhost/api/auth/google/redirect"));
    expect(res.headers.get("Location")).toContain("error=google_failed");
  });

  it("redirects to error when token exchange returns no access_token", async () => {
    process.env.FRONTEND_URL = "http://localhost:3000";
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      json: vi.fn().mockResolvedValueOnce({}),
    }));

    const { GET } = await import("@/app/api/auth/google/redirect/route");
    const res = await GET(new Request("http://localhost/api/auth/google/redirect?code=code1"));
    expect(res.headers.get("Location")).toContain("error=google_failed");
  });

  it("redirects to error when Google returns no email", async () => {
    process.env.FRONTEND_URL = "http://localhost:3000";
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ json: vi.fn().mockResolvedValueOnce({ access_token: "tok" }) })
      .mockResolvedValueOnce({ json: vi.fn().mockResolvedValueOnce({ id: "g1", name: "NoEmail" }) }),
    );

    const { GET } = await import("@/app/api/auth/google/redirect/route");
    const res = await GET(new Request("http://localhost/api/auth/google/redirect?code=code2"));
    expect(res.headers.get("Location")).toContain("error=google_failed");
  });

  it("creates new user and redirects to callback", async () => {
    process.env.FRONTEND_URL = "http://localhost:3000";
    const prisma = {
      user: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValueOnce({ id: 10, username: "testuser", email: "t@g.com", roleId: 2 }),
      },
      role: {
        findFirst: vi.fn().mockResolvedValueOnce({ id: 2, title: "user" }),
        findUnique: vi.fn().mockResolvedValueOnce({ id: 2, title: "user", rolePermissions: [] }),
      },
    };
    const createSession = vi.fn().mockResolvedValueOnce({ token: "sess-new" });
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ createSession }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ json: vi.fn().mockResolvedValueOnce({ access_token: "gtok" }) })
      .mockResolvedValueOnce({ json: vi.fn().mockResolvedValueOnce({ id: "g2", email: "t@g.com", name: "Test" }) }),
    );

    const { GET } = await import("@/app/api/auth/google/redirect/route");
    const res = await GET(new Request("http://localhost/api/auth/google/redirect?code=authcode"));
    expect(res.headers.get("Location")).toContain("/auth/google/callback");
    expect(res.headers.get("Location")).toContain("sess-new");
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it("finds existing user and redirects to callback", async () => {
    process.env.FRONTEND_URL = "http://localhost:3000";
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValueOnce({ id: 3, username: "alice", email: "alice@g.com", roleId: 1 }),
      },
      role: {
        findUnique: vi.fn().mockResolvedValueOnce({ id: 1, title: "user", rolePermissions: [] }),
      },
    };
    const createSession = vi.fn().mockResolvedValueOnce({ token: "sess-existing" });
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/session-service", () => ({ createSession }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ json: vi.fn().mockResolvedValueOnce({ access_token: "gtok2" }) })
      .mockResolvedValueOnce({ json: vi.fn().mockResolvedValueOnce({ id: "g3", email: "alice@g.com", name: "Alice" }) }),
    );

    const { GET } = await import("@/app/api/auth/google/redirect/route");
    const res = await GET(new Request("http://localhost/api/auth/google/redirect?code=authcode2"));
    expect(res.headers.get("Location")).toContain("sess-existing");
  });

  it("redirects to error on unexpected exception", async () => {
    process.env.FRONTEND_URL = "http://localhost:3000";
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network error")));

    const { GET } = await import("@/app/api/auth/google/redirect/route");
    const res = await GET(new Request("http://localhost/api/auth/google/redirect?code=code3"));
    expect(res.headers.get("Location")).toContain("error=google_failed");
  });

  it("redirects to 500 error when default role not found for new user", async () => {
    process.env.FRONTEND_URL = "http://localhost:3000";
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValueOnce(null) },
      role: { findFirst: vi.fn().mockResolvedValueOnce(null) },
    };
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction: vi.fn() }));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ json: vi.fn().mockResolvedValueOnce({ access_token: "tok" }) })
      .mockResolvedValueOnce({ json: vi.fn().mockResolvedValueOnce({ id: "g4", email: "x@g.com", name: "X" }) }),
    );

    const { GET } = await import("@/app/api/auth/google/redirect/route");
    const res = await GET(new Request("http://localhost/api/auth/google/redirect?code=code4"));
    expect(res.status).toBe(500);
  });
});
