import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("admin routes", () => {
  it("overview requires auth and permissions", async () => {
    const getCurrentUserFromRequest = vi.fn();
    const getAdminOverview = vi.fn();
    const requirePermission = vi.fn();

    vi.doMock("@/lib/splitmates", () => ({
      getCurrentUserFromRequest,
      getAdminOverview,
    }));
    vi.doMock("@/lib/splitmates/services/auth/permissions-service", () => ({
      requirePermission,
    }));

    const mod = await import("@/app/api/admin/overview/route");

    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const noAuth = await mod.GET(new Request("http://localhost/api/admin/overview"));
    expect(noAuth.status).toBe(401);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    getAdminOverview.mockResolvedValueOnce({ users: [], groups: [] });
    const ok = await mod.GET(new Request("http://localhost/api/admin/overview"));
    expect(ok.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledTimes(2);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockRejectedValueOnce(Object.assign(new Error("Nope"), { status: 403 }));
    const denied = await mod.GET(new Request("http://localhost/api/admin/overview"));
    expect(denied.status).toBe(403);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockResolvedValueOnce(undefined);
    requirePermission.mockResolvedValueOnce(undefined);
    getAdminOverview.mockRejectedValueOnce("boom");
    const error = await mod.GET(new Request("http://localhost/api/admin/overview"));
    expect(error.status).toBe(400);
  });

  it("user role patch and delete user route handle success and validation", async () => {
    const getCurrentUserFromRequest = vi.fn();
    const updateUserRole = vi.fn();
    const deleteUserAccount = vi.fn();
    const requirePermission = vi.fn();

    vi.doMock("@/lib/splitmates", () => ({
      getCurrentUserFromRequest,
      updateUserRole,
      deleteUserAccount,
    }));
    vi.doMock("@/lib/splitmates/services/auth/permissions-service", () => ({
      requirePermission,
    }));

    const roleMod = await import("@/app/api/admin/users/[userId]/role/route");
    const deleteMod = await import("@/app/api/admin/users/[userId]/route");

    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const noAuth = await roleMod.PATCH(new Request("http://localhost/api/admin/users/1/role", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    }), { params: Promise.resolve({ userId: "1" }) });
    expect(noAuth.status).toBe(401);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    const invalidRole = await roleMod.PATCH(new Request("http://localhost/api/admin/users/1/role", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }), { params: Promise.resolve({ userId: "1" }) });
    expect(invalidRole.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    updateUserRole.mockResolvedValueOnce({ id: 2, username: "ana", email: "a@x", createdAt: "2026-05-01T00:00:00.000Z", role: "user" });
    const ok = await roleMod.PATCH(new Request("http://localhost/api/admin/users/2/role", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    }), { params: Promise.resolve({ userId: "2" }) });
    expect(ok.status).toBe(200);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    const nonObjectBody = await roleMod.PATCH(new Request("http://localhost/api/admin/users/2/role", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify("not-an-object"),
    }), { params: Promise.resolve({ userId: "2" }) });
    expect(nonObjectBody.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    updateUserRole.mockRejectedValueOnce("boom");
    const nonErrorPatch = await roleMod.PATCH(new Request("http://localhost/api/admin/users/2/role", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    }), { params: Promise.resolve({ userId: "2" }) });
    expect(nonErrorPatch.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    const invalidId = await roleMod.PATCH(new Request("http://localhost/api/admin/users/0/role", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    }), { params: Promise.resolve({ userId: "0" }) });
    expect(invalidId.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    updateUserRole.mockResolvedValueOnce(null);
    const missingUser = await roleMod.PATCH(new Request("http://localhost/api/admin/users/99/role", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    }), { params: Promise.resolve({ userId: "99" }) });
    expect(missingUser.status).toBe(404);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockRejectedValueOnce(Object.assign(new Error("Nope"), { status: 403 }));
    const forbidden = await roleMod.PATCH(new Request("http://localhost/api/admin/users/2/role", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    }), { params: Promise.resolve({ userId: "2" }) });
    expect(forbidden.status).toBe(403);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deleteUserAccount.mockResolvedValueOnce({ id: 2, username: "ana", email: "a@x", createdAt: "2026-05-01T00:00:00.000Z" });
    const delOk = await deleteMod.DELETE(new Request("http://localhost/api/admin/users/2", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "2" }),
    });
    expect(delOk.status).toBe(200);

    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const delNoAuth = await deleteMod.DELETE(new Request("http://localhost/api/admin/users/2", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "2" }),
    });
    expect(delNoAuth.status).toBe(401);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    const delInvalid = await deleteMod.DELETE(new Request("http://localhost/api/admin/users/-1", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "-1" }),
    });
    expect(delInvalid.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deleteUserAccount.mockResolvedValueOnce(null);
    const delMissing = await deleteMod.DELETE(new Request("http://localhost/api/admin/users/99", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "99" }),
    });
    expect(delMissing.status).toBe(404);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deleteUserAccount.mockRejectedValueOnce("boom");
    const delNonError = await deleteMod.DELETE(new Request("http://localhost/api/admin/users/77", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "77" }),
    });
    expect(delNonError.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deleteUserAccount.mockRejectedValueOnce(new Error("boom-error"));
    const delError = await deleteMod.DELETE(new Request("http://localhost/api/admin/users/78", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "78" }),
    });
    expect(delError.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deleteUserAccount.mockRejectedValueOnce({ status: 418 });
    const delStatusObject = await deleteMod.DELETE(new Request("http://localhost/api/admin/users/88", { method: "DELETE" }), {
      params: Promise.resolve({ userId: "88" }),
    });
    expect(delStatusObject.status).toBe(418);
  });

  it("delete group route handles success and invalid ids", async () => {
    const getCurrentUserFromRequest = vi.fn();
    const deleteGroup = vi.fn();
    const requirePermission = vi.fn();

    vi.doMock("@/lib/splitmates", () => ({
      getCurrentUserFromRequest,
      deleteGroup,
    }));
    vi.doMock("@/lib/splitmates/services/auth/permissions-service", () => ({
      requirePermission,
    }));

    const mod = await import("@/app/api/admin/groups/[groupId]/route");

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    const invalid = await mod.DELETE(new Request("http://localhost/api/admin/groups/x", { method: "DELETE" }), {
      params: Promise.resolve({ groupId: "x" }),
    });
    expect(invalid.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deleteGroup.mockResolvedValueOnce({ id: 7 });
    const ok = await mod.DELETE(new Request("http://localhost/api/admin/groups/7", { method: "DELETE" }), {
      params: Promise.resolve({ groupId: "7" }),
    });
    expect(ok.status).toBe(200);

    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    const noAuth = await mod.DELETE(new Request("http://localhost/api/admin/groups/7", { method: "DELETE" }), {
      params: Promise.resolve({ groupId: "7" }),
    });
    expect(noAuth.status).toBe(401);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deleteGroup.mockRejectedValueOnce("boom");
    const nonError = await mod.DELETE(new Request("http://localhost/api/admin/groups/7", { method: "DELETE" }), {
      params: Promise.resolve({ groupId: "7" }),
    });
    expect(nonError.status).toBe(400);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    deleteGroup.mockResolvedValueOnce(null);
    const missing = await mod.DELETE(new Request("http://localhost/api/admin/groups/7", { method: "DELETE" }), {
      params: Promise.resolve({ groupId: "7" }),
    });
    expect(missing.status).toBe(404);

    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    requirePermission.mockRejectedValueOnce(Object.assign(new Error("Nope"), { status: 403 }));
    const denied = await mod.DELETE(new Request("http://localhost/api/admin/groups/7", { method: "DELETE" }), {
      params: Promise.resolve({ groupId: "7" }),
    });
    expect(denied.status).toBe(403);
  });
});