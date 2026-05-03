import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getAdminOverview, getCurrentUserFromRequest } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      return jsonError("You must be logged in to view the admin overview.", 401);
    }

    await requirePermission(actor.id, "View all users");
    await requirePermission(actor.id, "View all groups");

    const overview = await getAdminOverview();
    return jsonOk(overview);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to load admin overview.";
    return jsonError(message, status ?? 400);
  }
}