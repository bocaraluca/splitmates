import { expenseSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import {
  deleteExpense,
  getExpenseDetailForGroup,
  getGroupById,
  getCurrentUserFromRequest,
  updateExpense,
} from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ groupId: string; expenseId: string }> }) {
  const params = await context.params;
  const groupId = Number(params.groupId);
  const expenseId = Number(params.expenseId);
  if (!Number.isInteger(groupId) || groupId <= 0 || !Number.isInteger(expenseId) || expenseId <= 0) {
    return jsonError("Invalid id.", 400);
  }

  if (!await getGroupById(groupId)) {
    return jsonError("Group not found.", 404);
  }

  const viewer = await getCurrentUserFromRequest(request);
  const expense = await getExpenseDetailForGroup(groupId, expenseId, viewer?.id);
  if (!expense) {
    return jsonError("Expense not found.", 404);
  }

  return jsonOk(expense);
}

export async function PATCH(request: Request, context: { params: Promise<{ groupId: string; expenseId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      return jsonError("You must be logged in to edit an expense.", 401);
    }

    const params = await context.params;
    const groupId = Number(params.groupId);
    const expenseId = Number(params.expenseId);
    if (!Number.isInteger(groupId) || groupId <= 0 || !Number.isInteger(expenseId) || expenseId <= 0) {
      return jsonError("Invalid id.", 400);
    }

    const body = await request.json();
    const input = expenseSchema.parse(body);
    const expense = await updateExpense(groupId, expenseId, actor.id, input);

    if (!expense) {
      return jsonError("Expense not found.", 404);
    }

    return jsonOk({ expense });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update expense.";
    const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 400;
    return jsonError(message, status);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ groupId: string; expenseId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      return jsonError("You must be logged in to delete an expense.", 401);
    }

    const params = await context.params;
    const groupId = Number(params.groupId);
    const expenseId = Number(params.expenseId);
    if (!Number.isInteger(groupId) || groupId <= 0 || !Number.isInteger(expenseId) || expenseId <= 0) {
      return jsonError("Invalid id.", 400);
    }

    const expense = await deleteExpense(groupId, expenseId, actor.id);

    if (!expense) {
      return jsonError("Expense not found.", 404);
    }

    return jsonOk({ expense });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete expense.";
    const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 400;
    return jsonError(message, status);
  }
}

