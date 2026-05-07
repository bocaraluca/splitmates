import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  user: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  role: {
    findUnique: vi.fn(),
  },
} as any;

const createSession = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/splitmates/services/auth/session-service", () => ({ createSession }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("signup-service", () => {
  it("creates a user session and normalizes credentials", async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.role.findUnique.mockResolvedValueOnce({ id: 3, title: "user" });
    prisma.user.create.mockResolvedValueOnce({
      id: 7,
      username: "ana",
      email: "ana@example.com",
      createdAt: new Date("2026-05-06T10:00:00.000Z"),
    });
    createSession.mockResolvedValueOnce({ token: "session-7" });

    const { signupUser } = await import("@/lib/splitmates/services/auth/signup-service");
    const result = await signupUser({
      username: " Ana ",
      email: " ANA@EXAMPLE.COM ",
      password: "secret123",
    });

    expect(result.user.username).toBe("ana");
    expect(result.role).toBe("user");
    expect(createSession).toHaveBeenCalledWith(7);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: "ana",
          email: "ana@example.com",
          roleId: 3,
        }),
      }),
    );
  });

  it("rejects duplicate username, duplicate email, and missing role", async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ username: "ana", email: "ana@example.com" });

    const { signupUser } = await import("@/lib/splitmates/services/auth/signup-service");
    await expect(
      signupUser({ username: "ana", email: "ana2@example.com", password: "secret123" }),
    ).rejects.toThrow("Username already exists.");

    prisma.user.findFirst.mockResolvedValueOnce({ username: "ana", email: "ana@example.com" });
    await expect(
      signupUser({ username: "ana2", email: "ana@example.com", password: "secret123" }),
    ).rejects.toThrow("Email already exists.");

    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.role.findUnique.mockResolvedValueOnce(null);
    await expect(
      signupUser({ username: "new", email: "new@example.com", password: "secret123" }),
    ).rejects.toThrow("Default 'user' role is missing. Run the seed first.");
  });
});
