import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { createStripeAccount, unlinkStripeAccount } from "@/lib/splitmates/services/stripe-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) return jsonError("Unauthorized.", 401);

    const stripeAccountId = await createStripeAccount(actor.id);
    return jsonOk({ stripeAccountId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Stripe account.";
    return jsonError(message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) return jsonError("Unauthorized.", 401);

    await unlinkStripeAccount(actor.id);
    return jsonOk({ message: "Stripe account unlinked." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to unlink Stripe account.";
    return jsonError(message, 400);
  }
}
