import { paymentSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { createPayment, getGroupById, getPayments, getCurrentUserFromRequest } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const groupId = Number((await context.params).groupId);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return jsonError("Invalid group id.", 400);
  }

  if (!await getGroupById(groupId)) {
    return jsonError("Group not found.", 404);
  }

  return jsonOk({ payments: await getPayments(groupId) });
}

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      return jsonError("You must be logged in to create a Payment.", 401);
    }

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return jsonError("Invalid group id.", 400);
    }

    const body = await request.json();
    const input = paymentSchema.parse(body);
    const Payment = await createPayment(groupId, actor.id, input);

    return jsonOk({ Payment }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Payment.";
    return jsonError(message, 400);
  }
}

