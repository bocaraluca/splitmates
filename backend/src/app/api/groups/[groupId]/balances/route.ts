import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getGroupById, getCurrentUserFromRequest, balanceSummaryForUser } from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const actor = await getCurrentUserFromRequest(request);
  if (!actor) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_STATS_GET_UNAUTHORIZED,
      outcome: LogOutcome.failed,
    });
    return jsonError("Unauthorized.", 401);
  }

  const groupId = Number((await context.params).groupId);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_STATS_GET_INVALID_GROUP_ID,
      outcome: LogOutcome.validation_error,
    });
    return jsonError("Invalid group id.", 400);
  }

  if (!(await getGroupById(groupId))) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_STATS_GET_NOT_FOUND,
      outcome: LogOutcome.not_found,
      groupId,
    });
    return jsonError("Group not found.", 404);
  }

  const summary = await balanceSummaryForUser(actor.id, groupId);

  void logHttpAction({
    request,
    actionType: ACTION_TYPES.GROUP_STATS_GET,
    outcome: LogOutcome.success,
    groupId,
  });

  return jsonOk({ summary });
}
