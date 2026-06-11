import {
  LogActionType,
  LogOutcome,
  Prisma,
  SuspiciousStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { monitorSuspiciousUserBehavior } from "@/lib/splitmates/services/ai-monitor-service";
import { notifyAdminsSuspiciousUser } from "@/lib/splitmates/services/notification-service";

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
  note: string;
  actionJson: Prisma.InputJsonValue;
};

export type SuspiciousEvaluationResult = {
  suspiciousUserId: number;
  triggeredRules: Array<{
    ruleId: number;
    key: string;
    note: string;
  }>;
  suspiciousUser: {
    userId: number;
    status: SuspiciousStatus;
    reason: string | null;
  };
  alertCreated: boolean;
} | null;

const AI_LAST_CALLED = new Map<number, number>();
const AI_COOLDOWN_MS = 60 * 60 * 1000;

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

function normalizeActionJson(value: unknown): Prisma.InputJsonValue {
  if (value === null || value === undefined) return {};
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value) || isRecord(value)) return value as Prisma.InputJsonValue;
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
      createdAt: { gte: args.createdAtGte, lte: args.createdAtLte },
    },
  });
}

async function evaluateLoginFailedRule(
  log: SuspiciousLogInput,
  rule: DetectionRuleRecord,
): Promise<TriggeredRule | null> {
  if (log.actionType !== LOGIN_FAILED_ACTION_TYPE || log.outcome !== LogOutcome.failed) return null;

  const params = readParams(rule.params);
  const threshold = readNumberParam(params, "count", LOGIN_FAILED_MIN_COUNT);
  const windowMinutes = readNumberParam(params, "windowMin", LOGIN_FAILED_WINDOW_MINUTES);
  const count = await countMatchingLogs({
    userId: log.userId,
    actionTypes: [LOGIN_FAILED_ACTION_TYPE],
    outcome: LogOutcome.failed,
    createdAtGte: windowStartFromMinutes(log.createdAt, windowMinutes),
    createdAtLte: log.createdAt,
  });

  if (count < threshold) return null;

  return {
    rule,
    note: buildReason(rule, count, windowMinutes),
    actionJson: normalizeActionJson({ ruleKey: rule.key, threshold, windowMinutes, matchedCount: count, actionType: log.actionType }),
  };
}

async function evaluateDeleteRule(
  log: SuspiciousLogInput,
  rule: DetectionRuleRecord,
): Promise<TriggeredRule | null> {
  if (!DELETE_ACTION_TYPES.includes(log.actionType)) return null;

  const params = readParams(rule.params);
  const threshold = readNumberParam(params, "count", DELETE_ACTION_MIN_COUNT);
  const windowMinutes = readNumberParam(params, "windowMin", DELETE_ACTION_WINDOW_MINUTES);
  const count = await countMatchingLogs({
    userId: log.userId,
    actionTypes: DELETE_ACTION_TYPES,
    createdAtGte: windowStartFromMinutes(log.createdAt, windowMinutes),
    createdAtLte: log.createdAt,
  });

  if (count < threshold) return null;

  return {
    rule,
    note: buildReason(rule, count, windowMinutes),
    actionJson: normalizeActionJson({ ruleKey: rule.key, threshold, windowMinutes, matchedCount: count, actionType: log.actionType }),
  };
}

async function evaluateForbiddenRule(
  log: SuspiciousLogInput,
  rule: DetectionRuleRecord,
): Promise<TriggeredRule | null> {
  if (log.outcome !== LogOutcome.forbidden) return null;

  const params = readParams(rule.params);
  const threshold = readNumberParam(params, "count", FORBIDDEN_ACTION_MIN_COUNT);
  const windowMinutes = readNumberParam(params, "windowMin", FORBIDDEN_ACTION_WINDOW_MINUTES);
  const count = await countMatchingLogs({
    userId: log.userId,
    outcome: LogOutcome.forbidden,
    createdAtGte: windowStartFromMinutes(log.createdAt, windowMinutes),
    createdAtLte: log.createdAt,
  });

  if (count < threshold) return null;

  return {
    rule,
    note: buildReason(rule, count, windowMinutes),
    actionJson: normalizeActionJson({ ruleKey: rule.key, threshold, windowMinutes, matchedCount: count, outcome: log.outcome }),
  };
}

async function evaluateRateLimitedRule(
  log: SuspiciousLogInput,
  rule: DetectionRuleRecord,
): Promise<TriggeredRule | null> {
  if (log.outcome !== LogOutcome.rate_limited) return null;

  const params = readParams(rule.params);
  const threshold = readNumberParam(params, "count", RATE_LIMITED_MIN_COUNT);
  const windowMinutes = readNumberParam(params, "windowMin", RATE_LIMITED_WINDOW_MINUTES);
  const count = await countMatchingLogs({
    userId: log.userId,
    outcome: LogOutcome.rate_limited,
    createdAtGte: windowStartFromMinutes(log.createdAt, windowMinutes),
    createdAtLte: log.createdAt,
  });

  if (count < threshold) return null;

  return {
    rule,
    note: buildReason(rule, count, windowMinutes),
    actionJson: normalizeActionJson({ ruleKey: rule.key, threshold, windowMinutes, matchedCount: count, outcome: log.outcome }),
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

export async function evaluateLogForSuspiciousActivity(
  log: SuspiciousLogInput,
): Promise<SuspiciousEvaluationResult> {
  const rules = await loadActiveDetectionRules();
  const triggeredRules: TriggeredRule[] = [];

  for (const rule of rules) {
    const triggered = await evaluateRule(log, rule);
    if (triggered) triggeredRules.push(triggered);
  }

  if (!triggeredRules.length) return null;

  const reasons = triggeredRules.map((t) => t.note);
  const combinedReason = reasons.join(" | ");

  const existing = await prisma.suspiciousUser.findUnique({ where: { userId: log.userId } });

  const isNew = !existing;
  const existingLastSeen = existing?.lastSeen?.getTime() ?? 0;
  const aiAlreadyDoneRecently =
    !isNew &&
    existing?.reason &&
    !existing.reason.startsWith("Analyzing") &&
    Date.now() - existingLastSeen < AI_COOLDOWN_MS;

  const suspiciousUser = existing
    ? await prisma.suspiciousUser.update({
        where: { userId: log.userId },
        data: {
          status: SuspiciousStatus.underReview,
          ...(aiAlreadyDoneRecently ? {} : { reason: `Analyzing...\n\nRules: ${combinedReason}` }),
        },
      })
    : await prisma.suspiciousUser.create({
        data: { userId: log.userId, reason: `Analyzing...\n\nRules: ${combinedReason}`, status: SuspiciousStatus.underReview },
      });

  if (isNew) {
    const userRecord = await prisma.user.findUnique({ where: { id: log.userId }, select: { username: true } });
    setImmediate(() => {
      void notifyAdminsSuspiciousUser(log.userId, userRecord?.username ?? `user_${log.userId}`);
    });
  }

  for (const triggered of triggeredRules) {
    try {
      await prisma.observation.create({
        data: {
          suspiciousUserId: suspiciousUser.userId,
          logId: log.id,
          ruleId: triggered.rule.id,
          scoreIncrease: triggered.rule.weight,
          note: triggered.note,
          actionJson: triggered.actionJson,
        },
      });
    } catch {
    }
  }

  const result = {
    suspiciousUserId: log.userId,
    triggeredRules: triggeredRules.map((t) => ({
      ruleId: t.rule.id,
      key: t.rule.key,
      note: t.note,
    })),
    suspiciousUser: {
      userId: suspiciousUser.userId,
      status: suspiciousUser.status,
      reason: suspiciousUser.reason,
    },
    alertCreated: false,
  };

  if (aiAlreadyDoneRecently) {
    return result;
  }

  setImmediate(async () => {
    try {
      const lastCall = AI_LAST_CALLED.get(log.userId) ?? 0;
      if (Date.now() - lastCall < AI_COOLDOWN_MS) {
        return;
      }
      AI_LAST_CALLED.set(log.userId, Date.now());

      const [userRecord, recentLogs] = await Promise.all([
        prisma.user.findUnique({ where: { id: log.userId }, select: { username: true } }),
        prisma.log.findMany({
          where: { userId: log.userId },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { actionType: true, outcome: true, createdAt: true },
        }),
      ]);

      const aiReason = await monitorSuspiciousUserBehavior({
        userId: log.userId,
        username: userRecord?.username ?? `user_${log.userId}`,
        triggeredRules: triggeredRules.map((t) => ({ key: t.rule.key, note: t.note })),
        recentLogs: recentLogs.map((l) => ({
          actionType: l.actionType,
          outcome: l.outcome,
          createdAt: l.createdAt,
        })),
      });

      await prisma.suspiciousUser.update({
        where: { userId: log.userId },
        data: { reason: `${aiReason}\n\nRules: ${combinedReason}` },
      });
    } catch (err) {
      console.error("Background AI analysis failed:", err);
    }
  });

  return result;
}

export async function loadSuspiciousUsers() {
  return prisma.suspiciousUser.findMany({
    where: { status: { not: SuspiciousStatus.cleared } },
    orderBy: { lastSeen: "desc" },
    include: {
      observations: {
        orderBy: { createdAt: "desc" },
        include: { rule: { select: { key: true } } },
      },
      user: { select: { username: true, email: true } },
    },
  });
}

export async function clearSuspiciousUser(userId: number) {
  return prisma.suspiciousUser.update({
    where: { userId },
    data: { status: SuspiciousStatus.cleared, reason: null },
  });
}

export default {
  evaluateLogForSuspiciousActivity,
  loadSuspiciousUsers,
  clearSuspiciousUser,
  SUSPICIOUS_RULE_KEYS,
};