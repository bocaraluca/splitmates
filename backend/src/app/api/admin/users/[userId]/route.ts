import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { deleteUserAccount, getCurrentUserFromRequest } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      return jsonError("You must be logged in to delete a user account.", 401);
    }

    await requirePermission(actor.id, "Delete user");

    const { userId } = await context.params;
    const numericUserId = Number.parseInt(userId, 10);
    if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
      return jsonError("Invalid user id.", 400);
    }

    const deletedUser = await deleteUserAccount(numericUserId);
    if (!deletedUser) {
      return jsonError("User not found.", 404);
    }

    return jsonOk({ user: deletedUser });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to delete user account.";
    return jsonError(message, status ?? 400);
  }
}