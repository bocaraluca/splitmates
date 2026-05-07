import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserFromRequest = vi.fn();
const getUsers = vi.fn();
const getDashboardSummary = vi.fn();
const logHttpAction = vi.fn();

vi.mock("@/lib/splitmates", () => ({
  getCurrentUserFromRequest,
  getUsers,
  getDashboardSummary,
}));
vi.mock("@/lib/splitmates/api/http-action-log", () => ({ logHttpAction }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("dashboard route", () => {
  it("returns dashboard summary for authenticated user", async () => {
    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1, username: "alice" });
    getDashboardSummary.mockResolvedValueOnce({
      groups: [
        { id: 1, name: "Trip", totalSpent: 500 },
      ],
      recentExpenses: [],
    });

    const mod = await import("@/app/api/dashboard/route");
    const response = await mod.GET(new Request("http://localhost/api/dashboard"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.groups).toHaveLength(1);
    expect(payload.groups[0].name).toBe("Trip");
  });

  it("uses first user as fallback when not authenticated", async () => {
    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    getUsers.mockResolvedValueOnce([{ id: 2, username: "bob" }]);
    getDashboardSummary.mockResolvedValueOnce({
      groups: [],
      recentExpenses: [],
    });

    const mod = await import("@/app/api/dashboard/route");
    const response = await mod.GET(new Request("http://localhost/api/dashboard"));

    expect(response.status).toBe(200);
    expect(getDashboardSummary).toHaveBeenCalledWith(2);
    expect(logHttpAction).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackUserId: 2,
      })
    );
  });

  it("returns 404 when no users are available", async () => {
    getCurrentUserFromRequest.mockResolvedValueOnce(null);
    getUsers.mockResolvedValueOnce([]);

    const mod = await import("@/app/api/dashboard/route");
    const response = await mod.GET(new Request("http://localhost/api/dashboard"));

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error).toBe("No users are available.");
  });

  it("handles getDashboardSummary errors and returns 400", async () => {
    getCurrentUserFromRequest.mockResolvedValueOnce({ id: 1 });
    getDashboardSummary.mockRejectedValueOnce(new Error("Database connection failed"));

    const mod = await import("@/app/api/dashboard/route");
    const response = await mod.GET(new Request("http://localhost/api/dashboard"));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBe("Database connection failed");
  });
});
