import { jsonClearSession, jsonError } from "@/lib/splitmates/api/http";
import { revokeSessionToken, readSessionTokenFromRequest } from "@/lib/splitmates/services/auth/session-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import { ACTION_TYPES } from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await logHttpAction({
      request,
      actionType: ACTION_TYPES.AUTH_LOGOUT,
      outcome: LogOutcome.success,
    });

    const token = readSessionTokenFromRequest(request);
    revokeSessionToken(token);

    return jsonClearSession();
  } catch (error) {
    await logHttpAction({
      request,
      actionType: ACTION_TYPES.AUTH_LOGOUT_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: error instanceof Error ? error.message : String(error) },
    });

    return jsonError("Unable to log out.", 400);
  }
}
