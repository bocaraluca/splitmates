import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  group: {
    findMany: vi.fn(),
    delete: vi.fn(),
  },
  role: {
    findUnique: vi.fn(),
  },
  session: {
    deleteMany: vi.fn(),
  },
  expenseParticipant: {
    deleteMany: vi.fn(),
  },
  payment: {
    deleteMany: vi.fn(),
  },
  expense: {
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
} as any;

vi.mock("@/lib/prisma", () => ({ prisma }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin-service", () => {
  it("maps the admin overview payload", async () => {
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: 1,
        username: "raluca",
        email: "r@example.com",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        role: { title: "admin" },
        _count: { memberships: 2, groupsCreated: 1, expensesPaid: 4 },
      },
    ]);
    prisma.group.findMany.mockResolvedValueOnce([
      {
        id: 10,
        name: "Apartment",
        description: "Home",
        category: "household",
        createdAt: new Date("2026-05-02T00:00:00.000Z"),
        members: [{ user: { id: 1, username: "raluca" } }],
      },
    ]);

    const { getAdminOverview } = await import("@/lib/splitmates/services/admin-service");
    const overview = await getAdminOverview();

    expect(overview.users).toEqual([
      {
        id: 1,
        username: "raluca",
        email: "r@example.com",
        createdAt: "2026-05-01T00:00:00.000Z",
        role: "admin",
        membershipsCount: 2,
        groupsCreatedCount: 1,
        expensesPaidCount: 4,
      },
    ]);
    expect(overview.groups).toEqual([
      {
        id: 10,
        name: "Apartment",
        description: "Home",
        category: "household",
        createdAt: "2026-05-02T00:00:00.000Z",
        admins: [{ id: 1, username: "raluca" }],
        memberCount: 1,
      },
    ]);
  });

  it("deletes a user and their related records", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    const { deleteUserAccount } = await import("@/lib/splitmates/services/admin-service");

    await expect(deleteUserAccount(999)).resolves.toBeNull();

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 7,
      username: "ana",
      email: "a@example.com",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
    });

    const transaction = {
      session: { deleteMany: vi.fn() },
      expenseParticipant: { deleteMany: vi.fn() },
      payment: { deleteMany: vi.fn() },
      expense: { deleteMany: vi.fn() },
      group: { deleteMany: vi.fn() },
      user: { delete: vi.fn() },
    };
    prisma.$transaction.mockImplementationOnce(async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction));

    await expect(deleteUserAccount(7)).resolves.toEqual({
      id: 7,
      username: "ana",
      email: "a@example.com",
      createdAt: "2026-05-01T00:00:00.000Z",
    });
    expect(transaction.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
    expect(transaction.user.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it("updates a user role with validation and not-found handling", async () => {
    const { updateUserRole } = await import("@/lib/splitmates/services/admin-service");

    await expect(updateUserRole(1, "   ")).rejects.toThrow("Role is required.");

    prisma.role.findUnique.mockResolvedValueOnce(null);
    await expect(updateUserRole(1, "moderator")).rejects.toThrow("Role not found.");

    prisma.role.findUnique.mockResolvedValueOnce({ id: 4, title: "user" });
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(updateUserRole(2, "user")).resolves.toBeNull();

    prisma.role.findUnique.mockResolvedValueOnce({ id: 2, title: "admin" });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 2,
      username: "ana",
      email: "a@example.com",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
    });
    await expect(updateUserRole(2, "ADMIN")).resolves.toEqual({
      id: 2,
      username: "ana",
      email: "a@example.com",
      createdAt: "2026-05-01T00:00:00.000Z",
      role: "admin",
    });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { roleId: 2 } });
  });
});