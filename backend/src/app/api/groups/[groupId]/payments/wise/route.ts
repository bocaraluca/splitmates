import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { createWisePayment } from "@/lib/splitmates/services/wise-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";
import { z } from "zod";

export const runtime = "nodejs";

const wisePaymentSchema = z.object({
  fromUserId: z.number().int().positive(),
  toUserId: z.number().int().positive(),
  amount: z.number().positive(),
});

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_PAYMENTS_CREATE_UNAUTHORIZED,
        outcome: LogOutcome.failed,
      });
      return jsonError("You must be logged in to create a payment.", 401);
    }

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_PAYMENTS_CREATE_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        fallbackUserId: actor.id,
      });
      return jsonError("Invalid group id.", 400);
    }

    const body = await request.json();
    const input = wisePaymentSchema.parse(body);

    if (input.fromUserId !== actor.id) {
      return jsonError("You can only send payments from your own account.", 403);
    }

    const payment = await createWisePayment(groupId, actor.id, input.fromUserId, input.toUserId, input.amount);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_PAYMENTS_CREATE,
      outcome: LogOutcome.success,
      fallbackUserId: actor.id,
      actionJson: { groupId, amount: input.amount, fromUserId: input.fromUserId, toUserId: input.toUserId, method: "wise" },
    });

    return jsonOk({ payment }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Wise payment.";

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_PAYMENTS_CREATE_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, 400);
  }
}
