import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { deleteGroup, getCurrentUserFromRequest } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import { ACTION_TYPES } from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const { groupId: rawGroupId } = await context.params;
  const numericGroupId = Number.parseInt(rawGroupId, 10);
  const groupIdForLog = Number.isInteger(numericGroupId) && numericGroupId > 0 ? numericGroupId : null;

  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_GROUP_DELETE_UNAUTHORIZED,
        outcome: LogOutcome.forbidden,
        groupId: groupIdForLog,
        actionJson: { rawGroupId },
      });
      return jsonError("You must be logged in to delete a group.", 401);
    }

    try {
      await requirePermission(actor.id, "Delete any group");
    } catch (permissionError) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_GROUP_DELETE_FORBIDDEN,
        outcome: LogOutcome.forbidden,
        groupId: groupIdForLog,
        actionJson: { rawGroupId },
      });
      throw permissionError;
    }

    if (groupIdForLog === null) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_GROUP_DELETE_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        groupId: null,
        actionJson: { rawGroupId },
      });
      return jsonError("Invalid group id.", 400);
    }

    const deletedGroup = await deleteGroup(groupIdForLog, actor.id);
    if (!deletedGroup) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_GROUP_DELETE_NOT_FOUND,
        outcome: LogOutcome.not_found,
        groupId: groupIdForLog,
      });
      return jsonError("Group not found.", 404);
    }

    await logHttpAction({
      request,
      actionType: ACTION_TYPES.ADMIN_GROUP_DELETE,
      outcome: LogOutcome.success,
      groupId: groupIdForLog,
      actionJson: { groupName: deletedGroup.name },
    });

    return jsonOk({ group: deletedGroup });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to delete group.";

    if (status !== 403) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_GROUP_DELETE_FAILED,
        outcome: LogOutcome.failed,
        groupId: groupIdForLog,
        actionJson: { error: message },
      });
    }

    return jsonError(message, status ?? 400);
  }
}
