import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { stopGenerator } from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function POST(request: Request = new Request("http://localhost/api/generator/stop")) {
  try {
    const status = stopGenerator();

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GENERATOR_STOP,
      outcome: LogOutcome.success,
      actionJson: { status },
    });

    return jsonOk({ status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to stop fake expense generation.";

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GENERATOR_STOP_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, 400);
  }
}


