import {
  LogActionType,
  LogOutcome,
  Prisma,
  SuspiciousStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SUSPICIOUS_RULE_KEYS = {
  MULTIPLE_FAILED_LOGINS: "multiple_failed_logins",
  MANY_DELETE_ACTIONS: "many_delete_actions",
  REPEATED_FORBIDDEN_ACTIONS: "repeated_forbidden_actions",
  TOO_MANY_REQUESTS_BLOCKED: "too_many_requests_blocked",
} as const;

export type SuspiciousRuleKey = (typeof SUSPICIOUS_RULE_KEYS)[keyof typeof SUSPICIOUS_RULE_KEYS];

type SuspiciousLogInput = {
  id: bigint;
  userId: number;
  groupId: number | null;
  roleId: number | null;
  actionType: LogActionType;
  actionJson: Prisma.JsonValue | null;
  outcome: LogOutcome | null;
  createdAt: Date;
};

type DetectionRuleRecord = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  weight: number;
  params: Prisma.JsonValue | null;
};

type TriggeredRule = {
  rule: DetectionRuleRecord;
  scoreIncrease: number;
  note: string;
  actionJson: Prisma.InputJsonValue;
};

export type SuspiciousEvaluationResult = {
  suspiciousUserId: number;
  totalScoreIncrease: number;
  triggeredRules: Array<{
    ruleId: number;
    key: string;
    scoreIncrease: number;
    note: string;
  }>;
  suspiciousUser: {
    userId: number;
    status: SuspiciousStatus;
    reason: string | null;
  };
  alertCreated: boolean;
} | null;

const SUSPICIOUS_SCORE_THRESHOLD = 10;
const LOGIN_FAILED_MIN_COUNT = 5;
const LOGIN_FAILED_WINDOW_MINUTES = 5;
const DELETE_ACTION_MIN_COUNT = 10;
const DELETE_ACTION_WINDOW_MINUTES = 60;
const FORBIDDEN_ACTION_MIN_COUNT = 5;
const FORBIDDEN_ACTION_WINDOW_MINUTES = 60;
const RATE_LIMITED_MIN_COUNT = 4;
const RATE_LIMITED_WINDOW_MINUTES = 60;

const DELETE_ACTION_TYPES: LogActionType[] = [
  "GROUP_CHAT_MESSAGE_DELETE" as LogActionType,
  "GROUP_DETAIL_DELETE" as LogActionType,
  "GROUP_EXPENSES_DETAIL_DELETE" as LogActionType,
  "ADMIN_GROUP_DELETE" as LogActionType,
  "ADMIN_USER_DELETE" as LogActionType,
];

const LOGIN_FAILED_ACTION_TYPE = "AUTH_LOGIN_FAILED" as LogActionType;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readParams(params: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return isRecord(params) ? params : {};
}

function readNumberParam(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function windowStartFromMinutes(createdAt: Date, windowMinutes: number): Date {
  return new Date(createdAt.getTime() - windowMinutes * 60 * 1000);
}

function buildReason(rule: DetectionRuleRecord, count: number, windowMinutes: number): string {
  return `${rule.name}: ${count} events in the last ${windowMinutes} minutes`;
}

function buildAlertMessage(score: number, reasons: string[]): string {
  const joined = reasons.join("; ");
  return `Suspicious activity score reached ${score}. ${joined}`;
}

function normalizeActionJson(value: unknown): Prisma.InputJsonValue {
  if (value === null || value === undefined) {
    return {};
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value) || isRecord(value)) {
    return value as Prisma.InputJsonValue;
  }

  return {};
}

async function loadActiveDetectionRules(): Promise<DetectionRuleRecord[]> {
  return prisma.detectionRule.findMany({
    where: { enabled: true },
    orderBy: [{ weight: "desc" }, { id: "asc" }],
  });
}

async function countMatchingLogs(args: {
  userId: number;
  actionTypes?: LogActionType[];
  outcome?: LogOutcome;
  createdAtGte: Date;
  createdAtLte: Date;
}): Promise<number> {
  return prisma.log.count({
    where: {
      userId: args.userId,
      actionType: args.actionTypes ? { in: args.actionTypes } : undefined,
      outcome: args.outcome,
      createdAt: {
        gte: args.createdAtGte,
        lte: args.createdAtLte,
      },
    },
  });
}

async function evaluateLoginFailedRule(
  log: SuspiciousLogInput,
  rule: DetectionRuleRecord,
): Promise<TriggeredRule | null> {
  if (log.actionType !== LOGIN_FAILED_ACTION_TYPE || log.outcome !== LogOutcome.failed) {
    return null;
  }

  const params = readParams(rule.params);
  const threshold = readNumberParam(params, "count", LOGIN_FAILED_MIN_COUNT);
  const windowMinutes = readNumberParam(params, "windowMin", LOGIN_FAILED_WINDOW_MINUTES);
  const createdAtGte = windowStartFromMinutes(log.createdAt, windowMinutes);
  const count = await countMatchingLogs({
    userId: log.userId,
    actionTypes: [LOGIN_FAILED_ACTION_TYPE],
    outcome: LogOutcome.failed,
    createdAtGte,
    createdAtLte: log.createdAt,
  });

  if (count < threshold) {
    return null;
  }

  const note = buildReason(rule, count, windowMinutes);

  return {
    rule,
    scoreIncrease: rule.weight,
    note,
    actionJson: normalizeActionJson({
      ruleKey: rule.key,
      threshold,
      windowMinutes,
      matchedCount: count,
      actionType: log.actionType,
    }),
  };
}

async function evaluateDeleteRule(
  log: SuspiciousLogInput,
  rule: DetectionRuleRecord,
): Promise<TriggeredRule | null> {
  if (!DELETE_ACTION_TYPES.includes(log.actionType)) {
    return null;
  }

  const params = readParams(rule.params);
  const threshold = readNumberParam(params, "count", DELETE_ACTION_MIN_COUNT);
  const windowMinutes = readNumberParam(params, "windowMin", DELETE_ACTION_WINDOW_MINUTES);
  const createdAtGte = windowStartFromMinutes(log.createdAt, windowMinutes);
  const count = await countMatchingLogs({
    userId: log.userId,
    actionTypes: DELETE_ACTION_TYPES,
    createdAtGte,
    createdAtLte: log.createdAt,
  });

  if (count < threshold) {
    return null;
  }

  const note = buildReason(rule, count, windowMinutes);

  return {
    rule,
    scoreIncrease: rule.weight,
    note,
    actionJson: normalizeActionJson({
      ruleKey: rule.key,
      threshold,
      windowMinutes,
      matchedCount: count,
      actionType: log.actionType,
    }),
  };
}

async function evaluateForbiddenRule(
  log: SuspiciousLogInput,
  rule: DetectionRuleRecord,
): Promise<TriggeredRule | null> {
  if (log.outcome !== LogOutcome.forbidden) {
    return null;
  }

  const params = readParams(rule.params);
  const threshold = readNumberParam(params, "count", FORBIDDEN_ACTION_MIN_COUNT);
  const windowMinutes = readNumberParam(params, "windowMin", FORBIDDEN_ACTION_WINDOW_MINUTES);
  const createdAtGte = windowStartFromMinutes(log.createdAt, windowMinutes);
  const count = await countMatchingLogs({
    userId: log.userId,
    outcome: LogOutcome.forbidden,
    createdAtGte,
    createdAtLte: log.createdAt,
  });

  if (count < threshold) {
    return null;
  }

  const note = buildReason(rule, count, windowMinutes);

  return {
    rule,
    scoreIncrease: rule.weight,
    note,
    actionJson: normalizeActionJson({
      ruleKey: rule.key,
      threshold,
      windowMinutes,
      matchedCount: count,
      outcome: log.outcome,
    }),
  };
}

async function evaluateRateLimitedRule(
  log: SuspiciousLogInput,
  rule: DetectionRuleRecord,
): Promise<TriggeredRule | null> {
  if (log.outcome !== LogOutcome.rate_limited) {
    return null;
  }

  const params = readParams(rule.params);
  const threshold = readNumberParam(params, "count", RATE_LIMITED_MIN_COUNT);
  const windowMinutes = readNumberParam(params, "windowMin", RATE_LIMITED_WINDOW_MINUTES);
  const createdAtGte = windowStartFromMinutes(log.createdAt, windowMinutes);
  const count = await countMatchingLogs({
    userId: log.userId,
    outcome: LogOutcome.rate_limited,
    createdAtGte,
    createdAtLte: log.createdAt,
  });

  if (count < threshold) {
    return null;
  }

  const note = buildReason(rule, count, windowMinutes);

  return {
    rule,
    scoreIncrease: rule.weight,
    note,
    actionJson: normalizeActionJson({
      ruleKey: rule.key,
      threshold,
      windowMinutes,
      matchedCount: count,
      outcome: log.outcome,
    }),
  };
}

async function evaluateRule(
  log: SuspiciousLogInput,
  rule: DetectionRuleRecord,
): Promise<TriggeredRule | null> {
  switch (rule.key as SuspiciousRuleKey) {
    case SUSPICIOUS_RULE_KEYS.MULTIPLE_FAILED_LOGINS:
      return evaluateLoginFailedRule(log, rule);
    case SUSPICIOUS_RULE_KEYS.MANY_DELETE_ACTIONS:
      return evaluateDeleteRule(log, rule);
    case SUSPICIOUS_RULE_KEYS.REPEATED_FORBIDDEN_ACTIONS:
      return evaluateForbiddenRule(log, rule);
    case SUSPICIOUS_RULE_KEYS.TOO_MANY_REQUESTS_BLOCKED:
      return evaluateRateLimitedRule(log, rule);
    default:
      return null;
  }
}

async function createObservation(args: {
  suspiciousUserId: number;
  logId: bigint;
  ruleId: number;
  scoreIncrease: number;
  note: string;
  actionJson: Prisma.InputJsonValue;
}) {
  return prisma.observation.create({
    data: {
      suspiciousUserId: args.suspiciousUserId,
      logId: args.logId,
      ruleId: args.ruleId,
      scoreIncrease: args.scoreIncrease,
      note: args.note,
      actionJson: args.actionJson,
    },
  });
}

async function upsertSuspiciousUser(args: {
  userId: number;
  scoreIncrease: number;
  reason: string;
}) {
  const existing = await prisma.suspiciousUser.findUnique({
    where: { userId: args.userId },
  });

  const nextStatus =
    existing?.status === SuspiciousStatus.cleared
      ? SuspiciousStatus.underReview
      : existing?.status ?? SuspiciousStatus.underReview;

  const suspiciousUser = existing
    ? await prisma.suspiciousUser.update({
        where: { userId: args.userId },
        data: {
          reason: args.reason,
          status: nextStatus,
        },
      })
    : await prisma.suspiciousUser.create({
        data: {
          userId: args.userId,
          reason: args.reason,
          status: nextStatus,
        },
      });

  return {
    suspiciousUser,
    nextScore: args.scoreIncrease,
    previousStatus: existing?.status ?? null,
  };
}



export async function evaluateLogForSuspiciousActivity(
  log: SuspiciousLogInput,
): Promise<SuspiciousEvaluationResult> {
  const rules = await loadActiveDetectionRules();
  const triggeredRules: TriggeredRule[] = [];

  for (const rule of rules) {
    const triggered = await evaluateRule(log, rule);
    if (triggered) {
      triggeredRules.push(triggered);
    }
  }

  if (!triggeredRules.length) {
    return null;
  }

  const totalScoreIncrease = triggeredRules.reduce((sum, triggered) => sum + triggered.scoreIncrease, 0);
  const reasons = triggeredRules.map((triggered) => triggered.note);
  const combinedReason = reasons.join(" | ");

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.suspiciousUser.findUnique({
      where: { userId: log.userId },
    });

    const nextStatus = SuspiciousStatus.underReview;

    const suspiciousUser = existing
      ? await tx.suspiciousUser.update({
          where: { userId: log.userId },
          data: {
            reason: combinedReason,
            status: nextStatus,
          },
        })
      : await tx.suspiciousUser.create({
          data: {
            userId: log.userId,
            reason: combinedReason,
            status: nextStatus,
          },
        });

    for (const triggered of triggeredRules) {
      await tx.observation.create({
        data: {
          suspiciousUserId: suspiciousUser.userId,
          logId: log.id,
          ruleId: triggered.rule.id,
          scoreIncrease: triggered.scoreIncrease,
          note: triggered.note,
          actionJson: triggered.actionJson,
        },
      });
    }

    return {
      suspiciousUserId: log.userId,
      totalScoreIncrease,
      triggeredRules: triggeredRules.map((triggered) => ({
        ruleId: triggered.rule.id,
        key: triggered.rule.key,
        scoreIncrease: triggered.scoreIncrease,
        note: triggered.note,
      })),
      suspiciousUser: {
        userId: suspiciousUser.userId,
        status: suspiciousUser.status,
        reason: suspiciousUser.reason,
      },
      alertCreated: false,
    };
  });

  return result;
}

export async function loadSuspiciousUsers() {
  return prisma.suspiciousUser.findMany({
    where: {
      status: {
        not: SuspiciousStatus.cleared,
      },
    },
    orderBy: {
      lastSeen: "desc",
    },
    include: {
      observations: {
        orderBy: { createdAt: "desc" },
        include: {
          rule: {
            select: { key: true },
          },
        },
      },
      user: {
        select: {
          username: true,
          email: true,
        },
      },
    },
  });
}

export async function clearSuspiciousUser(userId: number) {
  return prisma.suspiciousUser.update({
    where: { userId },
    data: {
      status: SuspiciousStatus.cleared,
      reason: null,
    },
  });
}

export default {
  evaluateLogForSuspiciousActivity,
  loadSuspiciousUsers,
  clearSuspiciousUser,
  SUSPICIOUS_RULE_KEYS,
};
