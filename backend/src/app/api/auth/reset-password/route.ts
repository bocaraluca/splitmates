import { resetPasswordSchema } from "@/lib/splitmates/validation/schemas";
import { formatValidationError } from "@/lib/splitmates/validation/errors";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const input = resetPasswordSchema.parse(body);

        const resetToken = await prisma.passwordResetToken.findUnique({
            where: {
                token: input.token
            },
        });

        if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.AUTH_RESET_PASSWORD_INVALID_TOKEN,
                outcome: LogOutcome.failed,
                actionJson: { token: input.token },
            });
            return jsonError("Invalid or expired token.", 400);
        }

        const passwordHash = await bcrypt.hash(input.password, 12);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetToken.userId },
                data: { passwordHash },
            }),
            prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { usedAt: new Date() },
            }),
        ]);

        void logHttpAction({
            request,
            actionType: ACTION_TYPES.AUTH_RESET_PASSWORD,
            outcome: LogOutcome.success,
            fallbackUserId: resetToken.userId,
        });

        return jsonOk({ message: "Password has been reset successfully. You can now log in." });
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            return jsonError("Request body must be valid JSON", 400);
        }

        const message = formatValidationError(error, "Unable to reset password");
        return jsonError(message, 400);
    }
}