import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogOutcome, SuspiciousStatus } from "@prisma/client";

const prisma = {
  detectionRule: {
    findMany: vi.fn(),
  },
  log: {
    count: vi.fn(),
  },
  suspiciousUser: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  observation: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
} as any;

vi.mock("@/lib/prisma", () => ({ prisma }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

function buildRule(key: string, name: string, weight = 1) {
  return {
    id: 1,
    key,
    name,
    description: null,
    enabled: true,
    weight,
    params: null,
  };
}

describe("suspicious-user-service", () => {
  it("loads suspicious users and clears them", async () => {
    prisma.suspiciousUser.findMany.mockResolvedValueOnce([
      {
        userId: 7,
        reason: "Repeated failures",
        status: SuspiciousStatus.underReview,
        lastSeen: new Date("2026-05-06T10:00:00.000Z"),
        user: { username: "ana", email: "ana@example.com" },
        observations: [
          {
            note: "5 events in the last 5 minutes",
            createdAt: new Date("2026-05-06T10:00:00.000Z"),
            rule: { key: "multiple_failed_logins" },
          },
        ],
      },
    ]);
    prisma.suspiciousUser.update.mockResolvedValueOnce({
      userId: 7,
      reason: null,
      status: SuspiciousStatus.cleared,
      lastSeen: new Date("2026-05-06T10:00:00.000Z"),
    });

    const { loadSuspiciousUsers, clearSuspiciousUser } = await import("@/lib/splitmates/services/suspicious-user-service");
    const suspiciousUsers = await loadSuspiciousUsers();

    expect(suspiciousUsers).toHaveLength(1);
    expect(prisma.suspiciousUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            not: SuspiciousStatus.cleared,
          },
        },
      }),
    );

    const cleared = await clearSuspiciousUser(7);
    expect(cleared.status).toBe(SuspiciousStatus.cleared);
    expect(prisma.suspiciousUser.update).toHaveBeenCalledWith({
      where: { userId: 7 },
      data: {
        status: SuspiciousStatus.cleared,
        reason: null,
      },
    });
  });

  it("evaluates rule multiple_failed_logins and creates a suspicious user record", async () => {
    const ruleKey = "multiple_failed_logins";
    const rule = buildRule(ruleKey, `Rule ${ruleKey}`, 3);
    prisma.detectionRule.findMany.mockResolvedValueOnce([rule]);
    prisma.log.count.mockResolvedValueOnce(5);

    const tx = {
      suspiciousUser: {
        findUnique: vi.fn().mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValueOnce({ userId: 7, status: SuspiciousStatus.underReview, reason: `Rule ${ruleKey}: 5 events in the last 5 minutes` }),
        update: vi.fn(),
      },
      observation: {
        create: vi.fn().mockResolvedValueOnce({ id: 1 }),
      },
    } as any;
    prisma.$transaction.mockImplementationOnce(async (callback: (transaction: any) => Promise<unknown>) => callback(tx));

    const { evaluateLogForSuspiciousActivity } = await import("@/lib/splitmates/services/suspicious-user-service");
    const result = await evaluateLogForSuspiciousActivity({
      id: 11n,
      userId: 7,
      groupId: null,
      roleId: null,
      actionType: "AUTH_LOGIN_FAILED" as any,
      actionJson: null,
      outcome: LogOutcome.failed,
      createdAt: new Date("2026-05-06T10:00:00.000Z"),
    });

    expect(result).not.toBeNull();
    expect(result?.triggeredRules).toEqual([
      {
        ruleId: 1,
        key: ruleKey,
        scoreIncrease: 3,
        note: `Rule ${ruleKey}: 5 events in the last 5 minutes`,
      },
    ]);
    expect(result?.suspiciousUser).toEqual({
      userId: 7,
      status: SuspiciousStatus.underReview,
      reason: `Rule ${ruleKey}: 5 events in the last 5 minutes`,
    });
    expect(result?.alertCreated).toBe(false);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.observation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          suspiciousUserId: 7,
          logId: 11n,
          ruleId: 1,
          scoreIncrease: 3,
          note: `Rule ${ruleKey}: 5 events in the last 5 minutes`,
        }),
      }),
    );
  });

  it("evaluates rule many_delete_actions and creates a suspicious user record", async () => {
    const ruleKey = "many_delete_actions";
    const rule = buildRule(ruleKey, `Rule ${ruleKey}`, 3);
    prisma.detectionRule.findMany.mockResolvedValueOnce([rule]);
    prisma.log.count.mockResolvedValueOnce(10);

    const tx = {
      suspiciousUser: {
        findUnique: vi.fn().mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValueOnce({ userId: 7, status: SuspiciousStatus.underReview, reason: `Rule ${ruleKey}: 10 events in the last 60 minutes` }),
        update: vi.fn(),
      },
      observation: {
        create: vi.fn().mockResolvedValueOnce({ id: 1 }),
      },
    } as any;
    prisma.$transaction.mockImplementationOnce(async (callback: (transaction: any) => Promise<unknown>) => callback(tx));

    const { evaluateLogForSuspiciousActivity } = await import("@/lib/splitmates/services/suspicious-user-service");
    const result = await evaluateLogForSuspiciousActivity({
      id: 11n,
      userId: 7,
      groupId: null,
      roleId: null,
      actionType: "GROUP_CHAT_MESSAGE_DELETE" as any,
      actionJson: null,
      outcome: null,
      createdAt: new Date("2026-05-06T10:00:00.000Z"),
    });

    expect(result).not.toBeNull();
    expect(result?.triggeredRules).toEqual([
      {
        ruleId: 1,
        key: ruleKey,
        scoreIncrease: 3,
        note: `Rule ${ruleKey}: 10 events in the last 60 minutes`,
      },
    ]);
    expect(result?.suspiciousUser).toEqual({
      userId: 7,
      status: SuspiciousStatus.underReview,
      reason: `Rule ${ruleKey}: 10 events in the last 60 minutes`,
    });
    expect(result?.alertCreated).toBe(false);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.observation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          suspiciousUserId: 7,
          logId: 11n,
          ruleId: 1,
          scoreIncrease: 3,
          note: `Rule ${ruleKey}: 10 events in the last 60 minutes`,
        }),
      }),
    );
  });

  it("evaluates rule repeated_forbidden_actions and creates a suspicious user record", async () => {
    const ruleKey = "repeated_forbidden_actions";
    const rule = buildRule(ruleKey, `Rule ${ruleKey}`, 3);
    prisma.detectionRule.findMany.mockResolvedValueOnce([rule]);
    prisma.log.count.mockResolvedValueOnce(5);

    const tx = {
      suspiciousUser: {
        findUnique: vi.fn().mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValueOnce({ userId: 7, status: SuspiciousStatus.underReview, reason: `Rule ${ruleKey}: 5 events in the last 60 minutes` }),
        update: vi.fn(),
      },
      observation: {
        create: vi.fn().mockResolvedValueOnce({ id: 1 }),
      },
    } as any;
    prisma.$transaction.mockImplementationOnce(async (callback: (transaction: any) => Promise<unknown>) => callback(tx));

    const { evaluateLogForSuspiciousActivity } = await import("@/lib/splitmates/services/suspicious-user-service");
    const result = await evaluateLogForSuspiciousActivity({
      id: 11n,
      userId: 7,
      groupId: null,
      roleId: null,
      actionType: "GROUP_DETAIL_GET" as any,
      actionJson: null,
      outcome: LogOutcome.forbidden,
      createdAt: new Date("2026-05-06T10:00:00.000Z"),
    });

    expect(result).not.toBeNull();
    expect(result?.triggeredRules).toEqual([
      {
        ruleId: 1,
        key: ruleKey,
        scoreIncrease: 3,
        note: `Rule ${ruleKey}: 5 events in the last 60 minutes`,
      },
    ]);
    expect(result?.suspiciousUser).toEqual({
      userId: 7,
      status: SuspiciousStatus.underReview,
      reason: `Rule ${ruleKey}: 5 events in the last 60 minutes`,
    });
    expect(result?.alertCreated).toBe(false);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.observation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          suspiciousUserId: 7,
          logId: 11n,
          ruleId: 1,
          scoreIncrease: 3,
          note: `Rule ${ruleKey}: 5 events in the last 60 minutes`,
        }),
      }),
    );
  });

  it("evaluates rule too_many_requests_blocked and creates a suspicious user record", async () => {
    const ruleKey = "too_many_requests_blocked";
    const rule = buildRule(ruleKey, `Rule ${ruleKey}`, 3);
    prisma.detectionRule.findMany.mockResolvedValueOnce([rule]);
    prisma.log.count.mockResolvedValueOnce(5);

    const tx = {
      suspiciousUser: {
        findUnique: vi.fn().mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValueOnce({ userId: 7, status: SuspiciousStatus.underReview, reason: `Rule ${ruleKey}: 5 events in the last 60 minutes` }),
        update: vi.fn(),
      },
      observation: {
        create: vi.fn().mockResolvedValueOnce({ id: 1 }),
      },
    } as any;
    prisma.$transaction.mockImplementationOnce(async (callback: (transaction: any) => Promise<unknown>) => callback(tx));

    const { evaluateLogForSuspiciousActivity } = await import("@/lib/splitmates/services/suspicious-user-service");
    const result = await evaluateLogForSuspiciousActivity({
      id: 11n,
      userId: 7,
      groupId: null,
      roleId: null,
      actionType: "GROUP_DETAIL_GET" as any,
      actionJson: null,
      outcome: LogOutcome.rate_limited,
      createdAt: new Date("2026-05-06T10:00:00.000Z"),
    });

    expect(result).not.toBeNull();
    expect(result?.triggeredRules).toEqual([
      {
        ruleId: 1,
        key: ruleKey,
        scoreIncrease: 3,
        note: `Rule ${ruleKey}: 5 events in the last 60 minutes`,
      },
    ]);
    expect(result?.suspiciousUser).toEqual({
      userId: 7,
      status: SuspiciousStatus.underReview,
      reason: `Rule ${ruleKey}: 5 events in the last 60 minutes`,
    });
    expect(result?.alertCreated).toBe(false);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.observation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          suspiciousUserId: 7,
          logId: 11n,
          ruleId: 1,
          scoreIncrease: 3,
          note: `Rule ${ruleKey}: 5 events in the last 60 minutes`,
        }),
      }),
    );
  });

  it("returns null when no rule matches", async () => {
    prisma.detectionRule.findMany.mockResolvedValueOnce([buildRule("multiple_failed_logins", "Rule", 1)]);
    prisma.log.count.mockResolvedValueOnce(1);

    const { evaluateLogForSuspiciousActivity } = await import("@/lib/splitmates/services/suspicious-user-service");
    const result = await evaluateLogForSuspiciousActivity({
      id: 11n,
      userId: 7,
      groupId: null,
      roleId: null,
      actionType: "AUTH_LOGIN_FAILED" as any,
      actionJson: null,
      outcome: LogOutcome.failed,
      createdAt: new Date("2026-05-06T10:00:00.000Z"),
    });

    expect(result).toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
