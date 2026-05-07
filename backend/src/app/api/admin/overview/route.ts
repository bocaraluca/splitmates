import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getAdminOverview, getCurrentUserFromRequest } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import { ACTION_TYPES } from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_OVERVIEW_GET_UNAUTHORIZED,
        outcome: LogOutcome.forbidden,
      });
      return jsonError("You must be logged in to view the admin overview.", 401);
    }

    try {
      await requirePermission(actor.id, "View all users");
      await requirePermission(actor.id, "View all groups");
    } catch (permissionError) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_OVERVIEW_GET_FORBIDDEN,
        outcome: LogOutcome.forbidden,
      });
      throw permissionError;
    }

    const overview = await getAdminOverview();

    await logHttpAction({
      request,
      actionType: ACTION_TYPES.ADMIN_OVERVIEW_GET,
      outcome: LogOutcome.success,
      actionJson: { userCount: overview.users?.length ?? 0, groupCount: overview.groups?.length ?? 0 },
    });

    return jsonOk(overview);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to load admin overview.";

    if (status !== 403) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_OVERVIEW_GET_FAILED,
        outcome: LogOutcome.failed,
        actionJson: { error: message },
      });
    }

    return jsonError(message, status ?? 400);
  }
}
