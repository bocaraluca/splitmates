import { loginSchema } from "@/lib/splitmates/validation/schemas";
import { formatValidationError } from "@/lib/splitmates/validation/errors";
import { jsonError, jsonSessionOk } from "@/lib/splitmates/api/http";
import { loginUser } from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let attemptedIdentifier: string | null = null;

  try {
    const body = await request.json();
    const input = loginSchema.parse(body);
    attemptedIdentifier = input.identifier;

    const session = await loginUser(input);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.AUTH_LOGIN_SUCCESS,
      outcome: LogOutcome.success,
      fallbackUserId: session.user.id,
      actionJson: { identifier: attemptedIdentifier },
    });

    return jsonSessionOk(session, session.token);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }

    const message = formatValidationError(error, "Unable to log in.");
    const failedLoginUserId =
      error instanceof Error && typeof (error as Error & { userId?: unknown }).userId === "number"
        ? ((error as Error & { userId: number }).userId)
        : null;

    if (message === "Invalid login credentials.") {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.AUTH_LOGIN_FAILED,
        outcome: LogOutcome.failed,
        fallbackUserId: failedLoginUserId,
        actionJson: { identifier: attemptedIdentifier },
      });

      return jsonError(message, 401);
    }

    return jsonError(message, 400);
  }
}
