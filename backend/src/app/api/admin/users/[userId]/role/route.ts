import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest, updateUserRole } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      return jsonError("You must be logged in to update a user role.", 401);
    }

    await requirePermission(actor.id, "Update user role");

    const { userId } = await context.params;
    const numericUserId = Number.parseInt(userId, 10);
    if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
      return jsonError("Invalid user id.", 400);
    }

    const body = await request.json();
    const role = typeof body === "object" && body && "role" in body ? String((body as { role?: unknown }).role ?? "") : "";
    if (!role.trim()) {
      return jsonError("Role is required.", 400);
    }

    const updatedUser = await updateUserRole(numericUserId, role);
    if (!updatedUser) {
      return jsonError("User not found.", 404);
    }

    return jsonOk({ user: updatedUser });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to update user role.";
    return jsonError(message, status ?? 400);
  }
}