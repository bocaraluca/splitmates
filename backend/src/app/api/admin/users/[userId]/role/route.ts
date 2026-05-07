import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest, updateUserRole } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import { ACTION_TYPES } from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId: rawUserId } = await context.params;
  const numericUserId = Number.parseInt(rawUserId, 10);
  const targetUserIdForLog = Number.isInteger(numericUserId) && numericUserId > 0 ? numericUserId : null;

  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_USER_ROLE_UPDATE_UNAUTHORIZED,
        outcome: LogOutcome.forbidden,
        actionJson: { rawUserId, targetUserId: targetUserIdForLog },
      });
      return jsonError("You must be logged in to update a user role.", 401);
    }

    try {
      await requirePermission(actor.id, "Update user role");
    } catch (permissionError) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_USER_ROLE_UPDATE_FORBIDDEN,
        outcome: LogOutcome.forbidden,
        actionJson: { rawUserId, targetUserId: targetUserIdForLog },
      });
      throw permissionError;
    }

    if (targetUserIdForLog === null) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_USER_ROLE_UPDATE_INVALID_USER_ID,
        outcome: LogOutcome.validation_error,
        actionJson: { rawUserId },
      });
      return jsonError("Invalid user id.", 400);
    }

    const body = await request.json();
    const role = typeof body === "object" && body && "role" in body ? String((body as { role?: unknown }).role ?? "") : "";
    if (!role.trim()) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_USER_ROLE_UPDATE_INVALID_ROLE,
        outcome: LogOutcome.validation_error,
        actionJson: { targetUserId: targetUserIdForLog, role },
      });
      return jsonError("Role is required.", 400);
    }

    const updatedUser = await updateUserRole(targetUserIdForLog, role);
    if (!updatedUser) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_USER_ROLE_UPDATE_NOT_FOUND,
        outcome: LogOutcome.not_found,
        actionJson: { targetUserId: targetUserIdForLog, role },
      });
      return jsonError("User not found.", 404);
    }

    await logHttpAction({
      request,
      actionType: ACTION_TYPES.ADMIN_USER_ROLE_UPDATE,
      outcome: LogOutcome.success,
      actionJson: { targetUserId: targetUserIdForLog, newRole: role, targetUsername: updatedUser.username },
    });

    return jsonOk({ user: updatedUser });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to update user role.";

    if (status !== 403) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_USER_ROLE_UPDATE_FAILED,
        outcome: LogOutcome.failed,
        actionJson: { targetUserId: targetUserIdForLog, error: message },
      });
    }

    return jsonError(message, status ?? 400);
  }
}
