import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getDashboardSummary, getUsers, getCurrentUserFromRequest } from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessionUser = await getCurrentUserFromRequest(request);
  const fallbackUser = sessionUser ?? (await getUsers())[0] ?? null;

  if (!fallbackUser) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.DASHBOARD_GET_NO_USERS,
      outcome: LogOutcome.failed,
      actionJson: { reason: "No users are available." },
    });

    return jsonError("No users are available.", 404);
  }

  try {
    const dashboard = await getDashboardSummary(fallbackUser.id);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.DASHBOARD_GET,
      outcome: LogOutcome.success,
      fallbackUserId: fallbackUser.id,
    });

    return jsonOk(dashboard);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load dashboard.";

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.DASHBOARD_GET_FAILED,
      outcome: LogOutcome.failed,
      fallbackUserId: fallbackUser.id,
      actionJson: { error: message },
    });

    return jsonError(message, 400);
  }
}
