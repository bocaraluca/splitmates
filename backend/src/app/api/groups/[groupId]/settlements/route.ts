import { settlementSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { createSettlement, getGroupById, listSettlements, resolveCurrentUser } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const groupId = Number((await context.params).groupId);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return jsonError("Invalid group id.", 400);
  }

  if (!getGroupById(groupId)) {
    return jsonError("Group not found.", 404);
  }

  return jsonOk({ settlements: listSettlements(groupId) });
}

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = resolveCurrentUser(request);
    if (!actor) {
      return jsonError("You must be logged in to create a settlement.", 401);
    }

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return jsonError("Invalid group id.", 400);
    }

    const body = await request.json();
    const input = settlementSchema.parse(body);
    const settlement = createSettlement(groupId, actor.id, input);

    return jsonOk({ settlement }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create settlement.";
    return jsonError(message, 400);
  }
}

