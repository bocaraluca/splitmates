import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { deleteGroup, getCurrentUserFromRequest } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      return jsonError("You must be logged in to delete a group.", 401);
    }

    await requirePermission(actor.id, "Delete any group");

    const { groupId } = await context.params;
    const numericGroupId = Number.parseInt(groupId, 10);
    if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) {
      return jsonError("Invalid group id.", 400);
    }

    const deletedGroup = await deleteGroup(numericGroupId, actor.id);
    if (!deletedGroup) {
      return jsonError("Group not found.", 404);
    }

    return jsonOk({ group: deletedGroup });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to delete group.";
    return jsonError(message, status ?? 400);
  }
}