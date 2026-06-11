import { expenseSchema, paginationSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import {
  createExpense,
  getGroupById,
  getExpenses,
  getCurrentUserFromRequest,
} from "@/lib/splitmates";
import { ZodError } from "zod";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const actor = await getCurrentUserFromRequest(request);
  if (!actor) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_GET_UNAUTHORIZED,
      outcome: LogOutcome.failed,
    });
    return jsonError("Unauthorized to perform this action.", 401);
  }

  try {
    const parsedGroupId = Number((await context.params).groupId);
    if (!Number.isInteger(parsedGroupId) || parsedGroupId <= 0) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_EXPENSES_GET_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
      });

      return jsonError("Invalid group id.", 400);
    }

    if (!await getGroupById(parsedGroupId)) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_EXPENSES_GET_NOT_FOUND,
        outcome: LogOutcome.not_found,
        groupId: parsedGroupId,
      });

      return jsonError("Group not found.", 404);
    }

    const url = new URL(request.url);
    const query = paginationSchema.parse(Object.fromEntries(url.searchParams.entries()));
    const response = await getExpenses(parsedGroupId, query.page, query.pageSize, query.sortBy, query.sortOrder, query.category, query.paidByUserId);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_GET,
      outcome: LogOutcome.success,
      groupId: parsedGroupId,
      actionJson: { page: query.page, pageSize: query.pageSize },
    });

    return jsonOk(response);
  } catch (error) {
    if (error instanceof ZodError) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_EXPENSES_GET_FAILED,
        outcome: LogOutcome.validation_error,
      });

      return jsonError(error.issues[0]?.message ?? "Invalid query parameters.", 400);
    }

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_GET_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: error instanceof Error ? error.message : String(error) },
    });

    return jsonError("Unable to list expenses.", 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_EXPENSES_CREATE_UNAUTHORIZED,
        outcome: LogOutcome.failed,
      });

      return jsonError("You must be logged in to create an expense.", 401);
    }

    const parsedGroupId = Number((await context.params).groupId);
    if (!Number.isInteger(parsedGroupId) || parsedGroupId <= 0) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_EXPENSES_CREATE_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        fallbackUserId: actor.id,
      });

      return jsonError("Invalid group id.", 400);
    }

    const body = await request.json();
    const input = expenseSchema.parse(body);
    const expense = await createExpense(parsedGroupId, actor.id, input);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_CREATE,
      outcome: LogOutcome.success,
      fallbackUserId: actor.id,
      actionJson: { groupId: parsedGroupId, expenseId: expense.id, title: input.title },
    });

    return jsonOk({ expense }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create expense.";

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_EXPENSES_CREATE_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, 400);
  }
}
