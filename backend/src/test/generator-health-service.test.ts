import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  user: { count: vi.fn() },
  group: { count: vi.fn() },
  expense: { count: vi.fn() },
  payment: { count: vi.fn() },
} as any;

vi.mock("@/lib/prisma", () => ({ prisma }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("generator health-service", () => {
  it("getHealthSnapshot returns database counts and includes generator status", async () => {
    prisma.user.count.mockResolvedValueOnce(10);
    prisma.group.count.mockResolvedValueOnce(5);
    prisma.expense.count.mockResolvedValueOnce(100);
    prisma.payment.count.mockResolvedValueOnce(20);

    const { getHealthSnapshot } = await import("@/lib/splitmates/services/generator/health-service");
    const snapshot = await getHealthSnapshot();

    expect(snapshot.users).toBe(10);
    expect(snapshot.groups).toBe(5);
    expect(snapshot.expenses).toBe(100);
    expect(snapshot.payments).toBe(20);
    expect(snapshot.generator).toBeDefined();
    expect(snapshot.generator).toHaveProperty("running");
    expect(snapshot.generator).toHaveProperty("intervalMs");
    expect(snapshot.generator).toHaveProperty("generatedCount");
    expect(snapshot.generator).toHaveProperty("groupId");
  });

  it("fetches all database counts in parallel", async () => {
    prisma.user.count.mockResolvedValueOnce(1);
    prisma.group.count.mockResolvedValueOnce(1);
    prisma.expense.count.mockResolvedValueOnce(1);
    prisma.payment.count.mockResolvedValueOnce(1);

    const { getHealthSnapshot } = await import("@/lib/splitmates/services/generator/health-service");
    await getHealthSnapshot();

    expect(prisma.user.count).toHaveBeenCalled();
    expect(prisma.group.count).toHaveBeenCalled();
    expect(prisma.expense.count).toHaveBeenCalled();
    expect(prisma.payment.count).toHaveBeenCalled();
  });
});
