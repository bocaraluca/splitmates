import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { linkWiseEmail, unlinkWiseEmail } from "@/lib/splitmates/services/wise-service";
import { z } from "zod";

export const runtime = "nodejs";

const linkWiseSchema = z.object({
  wiseEmail: z.string().email(),
});

export async function PATCH(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) return jsonError("Unauthorized.", 401);

    const body = await request.json();
    const { wiseEmail } = linkWiseSchema.parse(body);

    const user = await linkWiseEmail(actor.id, wiseEmail);
    return jsonOk({ wiseEmail: user.wiseEmail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to link Wise account.";
    return jsonError(message, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) return jsonError("Unauthorized.", 401);

    await unlinkWiseEmail(actor.id);
    return jsonOk({ message: "Wise account unlinked." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to unlink Wise account.";
    return jsonError(message, 400);
  }
}
