import { expenseSchema, paginationSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import {
  createExpense,
  getGroupById,
  getExpenses,
  getCurrentUserFromRequest,
} from "@/lib/splitmates";
import { ZodError } from "zod";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const parsedGroupId = Number((await context.params).groupId);
    if (!Number.isInteger(parsedGroupId) || parsedGroupId <= 0) {
      return jsonError("Invalid group id.", 400);
    }

    if (!await getGroupById(parsedGroupId)) {
      return jsonError("Group not found.", 404);
    }

    const url = new URL(request.url);
    const query = paginationSchema.parse(Object.fromEntries(url.searchParams.entries()));
    const response = await getExpenses(parsedGroupId, query.page, query.pageSize, query.sortBy, query.sortOrder, query.category, query.paidByUserId);

    return jsonOk(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Invalid query parameters.", 400);
    }

    return jsonError("Unable to list expenses.", 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      return jsonError("You must be logged in to create an expense.", 401);
    }

    const parsedGroupId = Number((await context.params).groupId);
    if (!Number.isInteger(parsedGroupId) || parsedGroupId <= 0) {
      return jsonError("Invalid group id.", 400);
    }

    const body = await request.json();
    const input = expenseSchema.parse(body);
    const expense = await createExpense(parsedGroupId, actor.id, input);

    return jsonOk({ expense }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create expense.";
    return jsonError(message, 400);
  }
}

