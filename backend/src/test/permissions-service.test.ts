import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  user: {
    findUnique: vi.fn(),
  },
} as any;

vi.mock("@/lib/prisma", () => ({ prisma }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("permissions-service", () => {
  it("returns the role and permissions for a user", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      role: {
        title: "admin",
        rolePermissions: [
          { permission: { title: "View all groups" } },
          { permission: { title: "Delete user" } },
        ],
      },
    });

    const { getUserPermissions } = await import("@/lib/splitmates/services/auth/permissions-service");
    await expect(getUserPermissions(1)).resolves.toEqual({
      role: "admin",
      permissions: ["View all groups", "Delete user"],
    });
  });

  it("throws for missing users and enforces permissions", async () => {
    const { getUserPermissions, requirePermission } = await import("@/lib/splitmates/services/auth/permissions-service");

    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(getUserPermissions(99)).rejects.toThrow("User not found.");

    prisma.user.findUnique.mockResolvedValueOnce({
      role: { title: "admin", rolePermissions: [] },
    });
    await expect(requirePermission(1, "Delete user")).resolves.toBeUndefined();

    prisma.user.findUnique.mockResolvedValueOnce({
      role: { title: "user", rolePermissions: [{ permission: { title: "Delete user" } }] },
    });
    await expect(requirePermission(2, "Delete user")).resolves.toBeUndefined();

    prisma.user.findUnique.mockResolvedValueOnce({
      role: { title: "user", rolePermissions: [{ permission: { title: "View all groups" } }] },
    });
    await expect(requirePermission(2, "Delete user")).rejects.toMatchObject({ status: 403, message: "You do not have permission to perform this action." });
  });
});