import { signupSchema } from "@/lib/splitmates/validation/schemas";
import { formatValidationError } from "@/lib/splitmates/validation/errors";
import { jsonError, jsonSessionOk } from "@/lib/splitmates/api/http";
import { getUserRecordByIdentifier, signupUser } from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let attemptedUsername: string | null = null;
  let attemptedEmail: string | null = null;

  try {
    const body = await request.json();
    const input = signupSchema.parse(body);
    attemptedUsername = input.username;
    attemptedEmail = input.email;

    const session = await signupUser({
      username: input.username,
      email: input.email,
      password: input.password,
    });

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.AUTH_SIGNUP_SUCCESS,
      outcome: LogOutcome.success,
      fallbackUserId: session.user.id,
      actionJson: { username: session.user.username, email: session.user.email },
    });

    return jsonSessionOk(session, session.token, 201);
  } catch (error) {
    const message = formatValidationError(error, "Unable to sign up user.");

    if (message === "Username already exists." || message === "Email already exists.") {
      const conflictIdentifier =
        message === "Username already exists." ? attemptedUsername : attemptedEmail;

      if (conflictIdentifier) {
        const existingUser = await getUserRecordByIdentifier(conflictIdentifier);
        if (existingUser) {
          void logHttpAction({
            request,
            actionType: ACTION_TYPES.AUTH_SIGNUP_FAILED,
            outcome: LogOutcome.failed,
            fallbackUserId: existingUser.id,
            actionJson: {
              reason: message === "Username already exists." ? "username_taken" : "email_taken",
              attemptedUsername,
              attemptedEmail,
            },
          });
        }
      }
    }

    return jsonError(message, 400);
  }
}
