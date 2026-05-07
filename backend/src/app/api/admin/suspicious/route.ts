import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import { ACTION_TYPES } from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";
import { loadSuspiciousUsers } from "@/lib/splitmates/services/suspicious-user-service";

export const runtime = "nodejs";

function serializeSuspiciousUser(entry: Awaited<ReturnType<typeof loadSuspiciousUsers>>[number]) {
  return {
    userId: entry.userId,
    reason: entry.reason,
    flaggedAt: entry.lastSeen.toISOString(),
    user: {
      username: entry.user.username,
      email: entry.user.email,
    },
    observations: entry.observations.map((obs) => ({
      ruleKey: obs.rule?.key ?? "unknown",
      note: obs.note,
      createdAt: obs.createdAt.toISOString(),
    })),
  };
}

export async function GET(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_SUSPICIOUS_GET_UNAUTHORIZED,
        outcome: LogOutcome.forbidden,
      });
      return jsonError("You must be logged in to view suspicious users.", 401);
    }

    try {
      await requirePermission(actor.id, "View all users");
    } catch (permissionError) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_SUSPICIOUS_GET_FORBIDDEN,
        outcome: LogOutcome.forbidden,
      });
      throw permissionError;
    }

    const suspiciousUsers = await loadSuspiciousUsers();

    await logHttpAction({
      request,
      actionType: ACTION_TYPES.ADMIN_SUSPICIOUS_GET,
      outcome: LogOutcome.success,
      actionJson: { count: suspiciousUsers.length },
    });

    return jsonOk({
      suspiciousUsers: suspiciousUsers.map(serializeSuspiciousUser),
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to load suspicious users.";

    if (status !== 403) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_SUSPICIOUS_GET_FAILED,
        outcome: LogOutcome.failed,
        actionJson: { error: message },
      });
    }

    return jsonError(message, status ?? 400);
  }
}