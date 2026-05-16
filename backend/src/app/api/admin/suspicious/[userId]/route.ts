import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import { ACTION_TYPES } from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";
import { clearSuspiciousUser } from "@/lib/splitmates/services/suspicious-user-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId: rawUserId } = await context.params;
  const userId = Number.parseInt(rawUserId, 10);

  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_SUSPICIOUS_PATCH_UNAUTHORIZED,
        outcome: LogOutcome.forbidden,
        actionJson: { rawUserId },
      });
      return jsonError("You must be logged in to update a suspicious user.", 401);
    }

    try {
      await requirePermission(actor.id, "View all users");
    } catch (permissionError) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_SUSPICIOUS_PATCH_FORBIDDEN,
        outcome: LogOutcome.forbidden,
        actionJson: { rawUserId },
      });
      throw permissionError;
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_SUSPICIOUS_PATCH_INVALID_USER_ID,
        outcome: LogOutcome.validation_error,
        actionJson: { rawUserId },
      });
      return jsonError("Invalid user id.", 400);
    }

    const body = await request.json().catch(() => ({}));
    const status = typeof body === "object" && body && "status" in body ? String((body as { status?: unknown }).status ?? "") : "";

    if (!["underReview", "cleared"].includes(status)) {
      return jsonError("Invalid status.", 400);
    }

    const updated = status === "cleared"
      ? await clearSuspiciousUser(userId)
      : await import("@/lib/prisma").then(({ prisma }) => prisma.suspiciousUser.upsert({
          where: { userId },
          create: {
            userId,
            status: status as "underReview",
            reason: null,
            lastSeen: new Date(),
          },
          update: {
            status: status as "underReview",
          },
        }));

    await logHttpAction({
      request,
      actionType: ACTION_TYPES.ADMIN_SUSPICIOUS_PATCH,
      outcome: LogOutcome.success,
      actionJson: { userId, status },
    });

    return jsonOk({
      suspiciousUser: {
        userId: updated.userId,
        status: updated.status,
        reason: updated.reason,
        lastSeen: updated.lastSeen.toISOString(),
      },
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to update suspicious user.";

    if (status !== 403) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_SUSPICIOUS_PATCH_FAILED,
        outcome: LogOutcome.failed,
        actionJson: { rawUserId, error: message },
      });
    }

    return jsonError(message, status ?? 400);
  }
}