import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { deleteUserAccount, getCurrentUserFromRequest } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import { ACTION_TYPES } from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId: rawUserId } = await context.params;
  const numericUserId = Number.parseInt(rawUserId, 10);
  const targetUserIdForLog = Number.isInteger(numericUserId) && numericUserId > 0 ? numericUserId : null;

  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_USER_DELETE_UNAUTHORIZED,
        outcome: LogOutcome.forbidden,
        actionJson: { rawUserId, targetUserId: targetUserIdForLog },
      });
      return jsonError("You must be logged in to delete a user account.", 401);
    }

    try {
      await requirePermission(actor.id, "Delete user");
    } catch (permissionError) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_USER_DELETE_FORBIDDEN,
        outcome: LogOutcome.forbidden,
        actionJson: { rawUserId, targetUserId: targetUserIdForLog },
      });
      throw permissionError;
    }

    if (targetUserIdForLog === null) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_USER_DELETE_INVALID_USER_ID,
        outcome: LogOutcome.validation_error,
        actionJson: { rawUserId },
      });
      return jsonError("Invalid user id.", 400);
    }

    const deletedUser = await deleteUserAccount(targetUserIdForLog);
    if (!deletedUser) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_USER_DELETE_NOT_FOUND,
        outcome: LogOutcome.not_found,
        actionJson: { targetUserId: targetUserIdForLog },
      });
      return jsonError("User not found.", 404);
    }

    await logHttpAction({
      request,
      actionType: ACTION_TYPES.ADMIN_USER_DELETE,
      outcome: LogOutcome.success,
      actionJson: { targetUserId: targetUserIdForLog, deletedUsername: deletedUser.username },
    });

    return jsonOk({ user: deletedUser });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to delete user account.";

    if (status !== 403) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_USER_DELETE_FAILED,
        outcome: LogOutcome.failed,
        actionJson: { targetUserId: targetUserIdForLog, error: message },
      });
    }

    return jsonError(message, status ?? 400);
  }
}
