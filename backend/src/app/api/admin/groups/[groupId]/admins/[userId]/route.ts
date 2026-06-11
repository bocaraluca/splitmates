import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import { ACTION_TYPES } from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ groupId: string; userId: string }> }
) {
  const { groupId: rawGroupId, userId: rawUserId } = await context.params;
  const numericGroupId = Number.parseInt(rawGroupId, 10);
  const numericUserId = Number.parseInt(rawUserId, 10);
  const groupIdForLog = Number.isInteger(numericGroupId) && numericGroupId > 0 ? numericGroupId : null;
  const userIdForLog = Number.isInteger(numericUserId) && numericUserId > 0 ? numericUserId : null;

  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_GROUP_DELETE_UNAUTHORIZED,
        outcome: LogOutcome.forbidden,
        groupId: groupIdForLog,
        actionJson: { rawGroupId, rawUserId },
      });
      return jsonError("You must be logged in to manage group admins.", 401);
    }

    try {
      await requirePermission(actor.id, "Delete any group");
    } catch (permissionError) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_GROUP_DELETE_FORBIDDEN,
        outcome: LogOutcome.forbidden,
        groupId: groupIdForLog,
        actionJson: { rawGroupId, rawUserId },
      });
      throw permissionError;
    }

    if (groupIdForLog === null || userIdForLog === null) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_GROUP_DELETE_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        groupId: groupIdForLog,
        actionJson: { rawGroupId, rawUserId },
      });
      return jsonError("Invalid group id or user id.", 400);
    }

    const group = await prisma.group.findUnique({
      where: { id: groupIdForLog },
    });

    if (!group) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_GROUP_DELETE_NOT_FOUND,
        outcome: LogOutcome.not_found,
        groupId: groupIdForLog,
        actionJson: { userId: userIdForLog },
      });
      return jsonError("Group not found.", 404);
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: groupIdForLog, userId: userIdForLog } },
    });

    if (!membership) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_GROUP_DELETE_NOT_FOUND,
        outcome: LogOutcome.not_found,
        groupId: groupIdForLog,
        actionJson: { userId: userIdForLog },
      });
      return jsonError("User is not a member of this group.", 404);
    }

    const updatedMembership = await prisma.groupMember.update({
      where: { groupId_userId: { groupId: groupIdForLog, userId: userIdForLog } },
      data: { isAdmin: false },
    });

    await logHttpAction({
      request,
      actionType: ACTION_TYPES.ADMIN_GROUP_DELETE,
      outcome: LogOutcome.success,
      groupId: groupIdForLog,
      actionJson: { groupName: group.name, removedAdminId: userIdForLog },
    });

    return jsonOk({ membership: updatedMembership });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to remove group admin.";

    if (status !== 403) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_GROUP_DELETE_FAILED,
        outcome: LogOutcome.failed,
        groupId: groupIdForLog,
        actionJson: { error: message },
      });
    }

    return jsonError(message, status ?? 400);
  }
}
