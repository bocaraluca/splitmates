import { paymentSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { createPayment, getGroupById, getPayments, getCurrentUserFromRequest } from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const actor = await getCurrentUserFromRequest(_request);
  if (!actor) {
    void logHttpAction({
      request: _request,
      actionType: ACTION_TYPES.GROUP_PAYMENTS_GET_UNAUTHORIZED,
      outcome: LogOutcome.failed,
    });
    return jsonError("Unauthorized to perform this action.", 401);
  }

  const groupId = Number((await context.params).groupId);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    void logHttpAction({
      request: _request,
      actionType: ACTION_TYPES.GROUP_PAYMENTS_GET_INVALID_GROUP_ID,
      outcome: LogOutcome.validation_error,
    });

    return jsonError("Invalid group id.", 400);
  }

  if (!await getGroupById(groupId)) {
    void logHttpAction({
      request: _request,
      actionType: ACTION_TYPES.GROUP_PAYMENTS_GET_NOT_FOUND,
      outcome: LogOutcome.not_found,
      groupId,
    });

    return jsonError("Group not found.", 404);
  }

  const payments = await getPayments(groupId);

  void logHttpAction({
    request: _request,
    actionType: ACTION_TYPES.GROUP_PAYMENTS_GET,
    outcome: LogOutcome.success,
    groupId,
    actionJson: { count: payments.length },
  });

  return jsonOk({ payments });
}

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_PAYMENTS_CREATE_UNAUTHORIZED,
        outcome: LogOutcome.failed,
      });

      return jsonError("You must be logged in to create a Payment.", 401);
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
    const input = paymentSchema.parse(body);
    const Payment = await createPayment(groupId, actor.id, input);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_PAYMENTS_CREATE,
      outcome: LogOutcome.success,
      fallbackUserId: actor.id,
      actionJson: { groupId, amount: input.amount, fromUserId: input.fromUserId, toUserId: input.toUserId },
    });

    return jsonOk({ Payment }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Payment.";

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_PAYMENTS_CREATE_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, 400);
  }
}

