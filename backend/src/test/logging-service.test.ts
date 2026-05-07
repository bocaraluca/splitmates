import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogOutcome } from "@prisma/client";
import { Prisma } from "@prisma/client";

const prisma = {
  log: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
} as any;

const evaluateLogForSuspiciousActivity = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/splitmates/services/suspicious-user-service", () => ({
  evaluateLogForSuspiciousActivity,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("logging-service", () => {
  it("creates logs, normalizes fields, and swallows suspicious evaluation errors", async () => {
    const createdLog = {
      id: 1,
      userId: 7,
      roleTitle: "admin",
      requestId: "req-1",
      createdAt: new Date("2026-05-06T10:00:00.000Z"),
    };

    prisma.log.create.mockResolvedValueOnce(createdLog);
    evaluateLogForSuspiciousActivity.mockRejectedValueOnce(new Error("boom"));

    const { createLog } = await import("@/lib/splitmates/services/logging-service");
    const result = await createLog({
      userId: 7,
      groupId: 9,
      roleId: 3,
      roleTitle: " admin ",
      actionType: "AUTH_LOGIN_SUCCESS" as any,
      actionJson: { ok: true },
      ip: " 127.0.0.1 ",
      clientInfo: " browser ",
      requestId: " req-1 ",
      outcome: LogOutcome.success,
      createdAt: new Date("2026-05-06T10:00:00.000Z"),
    });

    expect(result).toBe(createdLog);
    expect(prisma.log.create).toHaveBeenCalledWith({
      data: {
        userId: 7,
        groupId: 9,
        roleId: 3,
        roleTitle: "admin",
        actionType: "AUTH_LOGIN_SUCCESS",
        actionJson: { ok: true },
        ip: "127.0.0.1",
        clientInfo: "browser",
        requestId: "req-1",
        outcome: LogOutcome.success,
        createdAt: new Date("2026-05-06T10:00:00.000Z"),
      },
    });
    expect(evaluateLogForSuspiciousActivity).toHaveBeenCalledWith(createdLog);
  });

  it("returns null for duplicate log request ids", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "0.0.1" }
    );
    prisma.log.create.mockRejectedValueOnce(prismaError);

    const { createLog } = await import("@/lib/splitmates/services/logging-service");
    await expect(
      createLog({
        userId: 7,
        actionType: "AUTH_LOGIN_SUCCESS" as any,
      }),
    ).resolves.toBeNull();
  });

  it("creates many logs, rejects missing request ids, and handles empty batches", async () => {
    const { createMultipleLogs } = await import("@/lib/splitmates/services/logging-service");

    await expect(createMultipleLogs([])).resolves.toEqual({ count: 0 });

    await expect(
      createMultipleLogs([
        {
          userId: 7,
          actionType: "AUTH_LOGIN_SUCCESS" as any,
        },
      ]),
    ).rejects.toThrow("requestId is required for createMultipleLogs");

    prisma.log.createMany.mockResolvedValueOnce({ count: 2 });
    await expect(
      createMultipleLogs([
        {
          userId: 7,
          groupId: 1,
          roleId: 2,
          roleTitle: " admin ",
          actionType: "AUTH_LOGIN_SUCCESS" as any,
          actionJson: { ok: true },
          ip: " 127.0.0.1 ",
          clientInfo: " browser ",
          requestId: " req-1 ",
          outcome: LogOutcome.success,
        },
        {
          userId: 8,
          actionType: "AUTH_LOGOUT" as any,
          requestId: "req-2",
        },
      ]),
    ).resolves.toEqual({ count: 2 });

    expect(prisma.log.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 7,
          groupId: 1,
          roleId: 2,
          roleTitle: "admin",
          actionType: "AUTH_LOGIN_SUCCESS",
          actionJson: { ok: true },
          ip: "127.0.0.1",
          clientInfo: "browser",
          requestId: "req-1",
          outcome: LogOutcome.success,
        }),
        expect.objectContaining({
          userId: 8,
          groupId: null,
          roleId: null,
          roleTitle: null,
          actionType: "AUTH_LOGOUT",
          requestId: "req-2",
          outcome: null,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("queries logs with filters and validates dates", async () => {
    prisma.log.findMany.mockResolvedValueOnce([
      {
        id: 1n,
        userId: 7,
        user: { username: "ana", email: "ana@example.com" },
        createdAt: new Date("2026-05-06T10:00:00.000Z"),
      },
    ]);
    prisma.log.count.mockResolvedValueOnce(1);

    const { getLogs, deleteLogsOlderThanDays } = await import("@/lib/splitmates/services/logging-service");

    await expect(
      getLogs(
        {
          userId: 7,
          user: "ana",
          actionType: "AUTH_LOGIN_SUCCESS" as any,
          outcome: LogOutcome.success,
          from: new Date("2026-05-01T00:00:00.000Z"),
          to: new Date("2026-05-07T00:00:00.000Z"),
        },
        {
          page: 0,
          pageSize: 999,
        },
      ),
    ).resolves.toEqual({
      items: [
        {
          id: 1n,
          userId: 7,
          user: { username: "ana", email: "ana@example.com" },
          createdAt: new Date("2026-05-06T10:00:00.000Z"),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 200,
      totalPages: 1,
    });

    expect(prisma.log.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 7,
          actionType: "AUTH_LOGIN_SUCCESS",
          outcome: LogOutcome.success,
          createdAt: {
            gte: new Date("2026-05-01T00:00:00.000Z"),
            lte: new Date("2026-05-07T00:00:00.000Z"),
          },
          AND: [
            {
              OR: [
                {
                  user: {
                    username: {
                      contains: "ana",
                      mode: "insensitive",
                    },
                  },
                },
                {
                  user: {
                    email: {
                      contains: "ana",
                      mode: "insensitive",
                    },
                  },
                },
              ],
            },
          ],
        }),
        include: {
          user: {
            select: {
              username: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 200,
      }),
    );

    await expect(getLogs({ from: new Date("2026-05-07T00:00:00.000Z"), to: new Date("2026-05-01T00:00:00.000Z") })).rejects.toThrow(
      "Invalid date range",
    );

    await expect(deleteLogsOlderThanDays(0)).rejects.toThrow("days must be a positive number");
    prisma.log.deleteMany.mockResolvedValueOnce({ count: 3 });
    await expect(deleteLogsOlderThanDays(7)).resolves.toEqual({ count: 3 });
    expect(prisma.log.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: expect.objectContaining({ lt: expect.any(Date) }),
      },
    });
  });

  it("rethrows unexpected createLog failures", async () => {
    prisma.log.create.mockRejectedValueOnce(new Error("db down"));

    const { createLog } = await import("@/lib/splitmates/services/logging-service");
    await expect(
      createLog({
        userId: 7,
        actionType: "AUTH_LOGIN_SUCCESS" as any,
      }),
    ).rejects.toThrow("db down");
  });
});
