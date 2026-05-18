import { z } from "zod";
import { formatValidationError } from "@/lib/splitmates/validation/errors";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { createMagicLink } from "@/lib/splitmates/services/auth/magic-link-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = schema.parse(body);

    const result = await createMagicLink(input.email);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.AUTH_MAGIC_LINK_REQUEST,
      outcome: LogOutcome.success,
      fallbackUserId: result.userId,
      actionJson: { email: input.email },
    });

    return jsonOk({ message: "A login link has been sent to your email." });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    const message = formatValidationError(error, "Unable to send login link.");

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.AUTH_MAGIC_LINK_REQUEST_FAILED,
      outcome: LogOutcome.failed,
    });

    return jsonError(message, 400);
  }
}