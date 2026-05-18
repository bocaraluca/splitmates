import { expenseSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import {
  deleteExpense,
  getExpenseDetailForGroup,
  getGroupById,
  getCurrentUserFromRequest,
  updateExpense,
} from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ groupId: string; expenseId: string }> }) {
  const viewer = await getCurrentUserFromRequest(request);
  if (!viewer) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_GET_UNAUTHORIZED,
      outcome: LogOutcome.failed,
    });
    return jsonError("Unauthorized to perform this action.", 401);
  }

  const params = await context.params;
  const groupId = Number(params.groupId);
  const expenseId = Number(params.expenseId);
  if (!Number.isInteger(groupId) || groupId <= 0 || !Number.isInteger(expenseId) || expenseId <= 0) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_GET_INVALID_GROUP_ID,
      outcome: LogOutcome.validation_error,
      actionJson: { groupId: params.groupId, expenseId: params.expenseId },
    });

    return jsonError("Invalid id.", 400);
  }

  if (!await getGroupById(groupId)) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_GET_NOT_FOUND,
      outcome: LogOutcome.not_found,
      groupId,
      actionJson: { expenseId },
    });

    return jsonError("Group not found.", 404);
  }

  const expense = await getExpenseDetailForGroup(groupId, expenseId, viewer.id);
  if (!expense) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_GET_NOT_FOUND,
      outcome: LogOutcome.not_found,
      groupId,
      actionJson: { expenseId },
    });

    return jsonError("Expense not found.", 404);
  }

  void logHttpAction({
    request,
    actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_GET,
    outcome: LogOutcome.success,
    groupId,
    actionJson: { expenseId },
  });

  return jsonOk(expense);
}

export async function PATCH(request: Request, context: { params: Promise<{ groupId: string; expenseId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_PATCH_UNAUTHORIZED,
        outcome: LogOutcome.failed,
      });

      return jsonError("You must be logged in to edit an expense.", 401);
    }

    const params = await context.params;
    const groupId = Number(params.groupId);
    const expenseId = Number(params.expenseId);
    if (!Number.isInteger(groupId) || groupId <= 0 || !Number.isInteger(expenseId) || expenseId <= 0) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_PATCH_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        fallbackUserId: actor.id,
        actionJson: { groupId: params.groupId, expenseId: params.expenseId },
      });

      return jsonError("Invalid id.", 400);
    }

    const body = await request.json();
    const input = expenseSchema.parse(body);
    const expense = await updateExpense(groupId, expenseId, actor.id, input);

    if (!expense) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_PATCH_NOT_FOUND,
        outcome: LogOutcome.not_found,
        fallbackUserId: actor.id,
        actionJson: { groupId, expenseId },
      });

      return jsonError("Expense not found.", 404);
    }

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_PATCH,
      outcome: LogOutcome.success,
      fallbackUserId: actor.id,
      actionJson: { groupId, expenseId },
    });

    return jsonOk({ expense });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update expense.";
    const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 400;

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_PATCH_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, status);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ groupId: string; expenseId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_DELETE_UNAUTHORIZED,
        outcome: LogOutcome.failed,
      });

      return jsonError("You must be logged in to delete an expense.", 401);
    }

    const params = await context.params;
    const groupId = Number(params.groupId);
    const expenseId = Number(params.expenseId);
    if (!Number.isInteger(groupId) || groupId <= 0 || !Number.isInteger(expenseId) || expenseId <= 0) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_DELETE_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        fallbackUserId: actor.id,
        actionJson: { groupId: params.groupId, expenseId: params.expenseId },
      });

      return jsonError("Invalid id.", 400);
    }

    const expense = await deleteExpense(groupId, expenseId, actor.id);

    if (!expense) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_DELETE_NOT_FOUND,
        outcome: LogOutcome.not_found,
        fallbackUserId: actor.id,
        actionJson: { groupId, expenseId },
      });

      return jsonError("Expense not found.", 404);
    }

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_DELETE,
      outcome: LogOutcome.success,
      fallbackUserId: actor.id,
      actionJson: { groupId, expenseId },
    });

    return jsonOk({ expense });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete expense.";
    const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 400;

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_DETAIL_DELETE_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, status);
  }
}

