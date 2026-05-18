import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getGeneratorStatus, getCurrentUserFromRequest } from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function GET(request: Request = new Request("http://localhost/api/generator/status")) {
  const currentUser = await getCurrentUserFromRequest(request);

  if (!currentUser) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GENERATOR_STATUS_GET_UNAUTHORIZED,
      outcome: LogOutcome.failed,
    });
    return jsonError("Unauthorized to perform this action.", 401);
  }

  try {
    const status = getGeneratorStatus();

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GENERATOR_STATUS_GET,
      outcome: LogOutcome.success,
      actionJson: { status },
    });

    return jsonOk({ status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load generator status.";

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GENERATOR_STATUS_GET_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, 400);
  }
}
