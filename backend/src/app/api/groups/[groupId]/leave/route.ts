import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { leaveGroup, getCurrentUserFromRequest } from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_LEAVE_UNAUTHORIZED,
        outcome: LogOutcome.failed,
      });

      return jsonError("You must be logged in to leave a group.", 401);
    }

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_LEAVE_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        fallbackUserId: currentUser.id,
      });

      return jsonError("Invalid group id.", 400);
    }

    const group = await leaveGroup(groupId, currentUser.id);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_LEAVE,
      outcome: LogOutcome.success,
      fallbackUserId: currentUser.id,
      actionJson: { groupId },
    });

    return jsonOk({ group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to leave group.";

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_LEAVE_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, 400);
  }
}
