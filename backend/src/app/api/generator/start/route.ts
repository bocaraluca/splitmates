import { generatorSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { startGenerator, getCurrentUserFromRequest } from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const currentUser = await getCurrentUserFromRequest(request);

  if (!currentUser) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GENERATOR_START_UNAUTHORIZED,
      outcome: LogOutcome.failed,
    });
    return jsonError("Unauthorized to perform this action.", 401);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const input = generatorSchema.parse(body);
    const status = await startGenerator(input.groupId ?? null);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GENERATOR_START,
      outcome: LogOutcome.success,
      actionJson: { groupId: input.groupId ?? null, status },
    });

    return jsonOk({ status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start fake expense generation.";
    const actionType = error instanceof Error && error.name === "ZodError"
      ? ACTION_TYPES.GENERATOR_START_INVALID_PAYLOAD
      : ACTION_TYPES.GENERATOR_START_FAILED;

    void logHttpAction({
      request,
      actionType,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, 400);
  }
}


