import { forgotPasswordSchema } from "@/lib/splitmates/validation/schemas";
import { formatValidationError } from "@/lib/splitmates/validation/errors";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { createPasswordResetToken } from "@/lib/splitmates/services/auth/reset-password-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const input = forgotPasswordSchema.parse(body);

        const result = await createPasswordResetToken(input.email);

        if (!result) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.AUTH_FORGOT_PASSWORD_FAILED,
                outcome: LogOutcome.not_found,
                actionJson: { email: input.email },
            })
            return jsonOk({ message: "If an account with that email exists, a password reset link has been sent." });
        }

        void logHttpAction({
            request,
            actionType: ACTION_TYPES.AUTH_FORGOT_PASSWORD,
            outcome: LogOutcome.success,
            fallbackUserId: result.userId,
            actionJson: { email: input.email },
        });

        return jsonOk({ message: "A password reset link has been sent to your email." });
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            return jsonError("Request body must be valid JSON", 400);
        }

        const message = formatValidationError(error, "Invalid request body");
        return jsonError(message, 400);
    }
}