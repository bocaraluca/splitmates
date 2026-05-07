import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("health route", () => {
  it("returns ok status with database counts and generator status", async () => {
    const mockHealthSnapshot = {
      users: 5,
      groups: 3,
      expenses: 42,
      payments: 8,
      generator: { running: false },
    };

    vi.doMock("@/lib/splitmates", () => ({
      getHealthSnapshot: vi.fn().mockResolvedValue(mockHealthSnapshot),
    }));

    const mod = await import("@/app/api/health/route");
    const response = await mod.GET();

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.users).toBe(5);
    expect(payload.groups).toBe(3);
    expect(payload.expenses).toBe(42);
    expect(payload.payments).toBe(8);
    expect(payload.generator).toEqual({ running: false });
  });
});
