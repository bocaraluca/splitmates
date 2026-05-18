import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("createPasswordResetToken", () => {
  it("returns token and userId when user exists", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValueOnce({ id: 1, email: "u@x.com" }) },
      passwordResetToken: { create: vi.fn().mockResolvedValueOnce({}) },
    };
    const sendPasswordResetEmail = vi.fn().mockResolvedValueOnce(undefined);
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", () => ({ sendPasswordResetEmail }));

    const { createPasswordResetToken } = await import("@/lib/splitmates/services/auth/reset-password-service");
    const result = await createPasswordResetToken("u@x.com");
    expect(result).not.toBeNull();
    expect(result?.userId).toBe(1);
    expect(result?.token).toMatch(/^[a-f0-9]{64}$/);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith("u@x.com", expect.any(String));
  });

  it("returns null when user not found", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValueOnce(null) },
      passwordResetToken: { create: vi.fn() },
    };
    const sendPasswordResetEmail = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", () => ({ sendPasswordResetEmail }));

    const { createPasswordResetToken } = await import("@/lib/splitmates/services/auth/reset-password-service");
    const result = await createPasswordResetToken("ghost@x.com");
    expect(result).toBeNull();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe("createMagicLink", () => {
  it("creates token with userId when user exists", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValueOnce({ id: 5 }) },
      magicLinkToken: { create: vi.fn().mockResolvedValueOnce({}) },
    };
    const sendMagicLinkEmail = vi.fn().mockResolvedValueOnce(undefined);
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", () => ({ sendMagicLinkEmail }));

    const { createMagicLink } = await import("@/lib/splitmates/services/auth/magic-link-service");
    const result = await createMagicLink("u@x.com");
    expect(result.userId).toBe(5);
    expect(sendMagicLinkEmail).toHaveBeenCalledWith("u@x.com", expect.any(String));
  });

  it("creates token with null userId when user does not exist", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValueOnce(null) },
      magicLinkToken: { create: vi.fn().mockResolvedValueOnce({}) },
    };
    const sendMagicLinkEmail = vi.fn().mockResolvedValueOnce(undefined);
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", () => ({ sendMagicLinkEmail }));

    const { createMagicLink } = await import("@/lib/splitmates/services/auth/magic-link-service");
    const result = await createMagicLink("new@x.com");
    expect(result.userId).toBeNull();
  });
});

describe("verifyMagicLink", () => {
  it("returns null when token not found", async () => {
    const prisma = {
      magicLinkToken: { findUnique: vi.fn().mockResolvedValueOnce(null) },
    };
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", () => ({ sendMagicLinkEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }));

    const { verifyMagicLink } = await import("@/lib/splitmates/services/auth/magic-link-service");
    expect(await verifyMagicLink("bad-token")).toBeNull();
  });

  it("returns null when token is already used", async () => {
    const prisma = {
      magicLinkToken: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: 1, email: "u@x.com", user: { id: 5 },
          usedAt: new Date(), expiresAt: new Date(Date.now() + 3600000),
        }),
      },
    };
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", () => ({ sendMagicLinkEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }));

    const { verifyMagicLink } = await import("@/lib/splitmates/services/auth/magic-link-service");
    expect(await verifyMagicLink("used-tok")).toBeNull();
  });

  it("returns null when token is expired", async () => {
    const prisma = {
      magicLinkToken: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: 1, email: "u@x.com", user: { id: 5 },
          usedAt: null, expiresAt: new Date(Date.now() - 1000),
        }),
      },
    };
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", () => ({ sendMagicLinkEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }));

    const { verifyMagicLink } = await import("@/lib/splitmates/services/auth/magic-link-service");
    expect(await verifyMagicLink("expired-tok")).toBeNull();
  });

  it("returns existing user and marks token used", async () => {
    const user = { id: 5, username: "alice", email: "u@x.com" };
    const prisma = {
      magicLinkToken: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: 1, email: "u@x.com", user,
          usedAt: null, expiresAt: new Date(Date.now() + 3600000),
        }),
        update: vi.fn().mockResolvedValueOnce({}),
      },
    };
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", () => ({ sendMagicLinkEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }));

    const { verifyMagicLink } = await import("@/lib/splitmates/services/auth/magic-link-service");
    const result = await verifyMagicLink("valid-tok");
    expect(result?.username).toBe("alice");
    expect(prisma.magicLinkToken.update).toHaveBeenCalled();
  });

  it("creates new user when token has no linked user", async () => {
    const prisma = {
      magicLinkToken: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: 1, email: "new@x.com", user: null,
          usedAt: null, expiresAt: new Date(Date.now() + 3600000),
        }),
        update: vi.fn().mockResolvedValueOnce({}),
      },
      role: { findFirst: vi.fn().mockResolvedValueOnce({ id: 2, title: "user" }) },
      user: { create: vi.fn().mockResolvedValueOnce({ id: 9, username: "new_abc", email: "new@x.com" }) },
    };
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", () => ({ sendMagicLinkEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }));

    const { verifyMagicLink } = await import("@/lib/splitmates/services/auth/magic-link-service");
    const result = await verifyMagicLink("new-tok");
    expect(result?.email).toBe("new@x.com");
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it("throws when default role not found", async () => {
    const prisma = {
      magicLinkToken: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: 1, email: "new@x.com", user: null,
          usedAt: null, expiresAt: new Date(Date.now() + 3600000),
        }),
      },
      role: { findFirst: vi.fn().mockResolvedValueOnce(null) },
    };
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", () => ({ sendMagicLinkEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }));

    const { verifyMagicLink } = await import("@/lib/splitmates/services/auth/magic-link-service");
    await expect(verifyMagicLink("no-role-tok")).rejects.toThrow("Default role not found.");
  });
});

describe("mail-service", () => {
  it("sendPasswordResetEmail sends email with reset URL", async () => {
    const sendMail = vi.fn().mockResolvedValueOnce({});
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValueOnce({ username: "alice" }) },
    };
    vi.doMock("nodemailer", () => ({
      default: { createTransport: vi.fn().mockReturnValue({ sendMail }) },
    }));
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", async () =>
      await vi.importActual<typeof import("@/lib/splitmates/services/auth/mail-service")>("@/lib/splitmates/services/auth/mail-service")
    );
    process.env.FRONTEND_URL = "http://localhost:3000";
    process.env.SMTP_USER = "test@gmail.com";

    const { sendPasswordResetEmail } = await import("@/lib/splitmates/services/auth/mail-service");
    await sendPasswordResetEmail("alice@x.com", "reset-tok-123");

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "alice@x.com",
      subject: expect.stringContaining("Reset"),
    }));
    expect(sendMail.mock.calls[0][0].html).toContain("reset-tok-123");
  });

  it("sendPasswordResetEmail uses email as fallback username when user not found", async () => {
    const sendMail = vi.fn().mockResolvedValueOnce({});
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValueOnce(null) },
    };
    vi.doMock("nodemailer", () => ({
      default: { createTransport: vi.fn().mockReturnValue({ sendMail }) },
    }));
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", async () =>
      await vi.importActual<typeof import("@/lib/splitmates/services/auth/mail-service")>("@/lib/splitmates/services/auth/mail-service")
    );
    process.env.FRONTEND_URL = "http://localhost:3000";
    process.env.SMTP_USER = "test@gmail.com";

    const { sendPasswordResetEmail } = await import("@/lib/splitmates/services/auth/mail-service");
    await sendPasswordResetEmail("ghost@x.com", "tok");

    expect(sendMail.mock.calls[0][0].html).toContain("ghost@x.com");
  });

  it("sendMagicLinkEmail sends email with magic link URL", async () => {
    const sendMail = vi.fn().mockResolvedValueOnce({});
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValueOnce({ username: "bob" }) },
    };
    vi.doMock("nodemailer", () => ({
      default: { createTransport: vi.fn().mockReturnValue({ sendMail }) },
    }));
    vi.doMock("@/lib/prisma", () => ({ prisma }));
    vi.doMock("@/lib/splitmates/services/auth/mail-service", async () =>
      await vi.importActual<typeof import("@/lib/splitmates/services/auth/mail-service")>("@/lib/splitmates/services/auth/mail-service")
    );
    process.env.FRONTEND_URL = "http://localhost:3000";
    process.env.SMTP_USER = "test@gmail.com";

    const { sendMagicLinkEmail } = await import("@/lib/splitmates/services/auth/mail-service");
    await sendMagicLinkEmail("bob@x.com", "magic-tok-abc");

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "bob@x.com",
      subject: expect.stringContaining("Login"),
    }));
    expect(sendMail.mock.calls[0][0].html).toContain("magic-tok-abc");
  });
});
