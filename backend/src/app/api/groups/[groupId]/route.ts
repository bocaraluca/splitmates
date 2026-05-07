import { createGroupSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { mapGroupForResponse } from "@/lib/splitmates/api/group-response";
import {
  deleteGroup,
  getDashboardSummary,
  getGroupById,
  getCurrentUserFromRequest,
  updateGroup,
} from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

function outcomeFromStatus(status: number): LogOutcome {
  if (status === 403) return LogOutcome.forbidden;
  if (status === 404) return LogOutcome.not_found;
  if (status === 400) return LogOutcome.validation_error;
  return LogOutcome.failed;
}

export async function GET(request: Request, context: { params: Promise<{ groupId: string }> }) {
  let groupId: number | null = null;

  try {
    const groupIdParam = (await context.params).groupId;
    groupId = Number(groupIdParam);

    if (!Number.isInteger(groupId) || groupId <= 0) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_DETAIL_GET_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        groupId: undefined,
        actionJson: { groupId: groupIdParam },
      });

      return jsonError("Invalid group id.", 400);
    }

    const group = await getGroupById(groupId);
    if (!group) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_DETAIL_GET_NOT_FOUND,
        outcome: LogOutcome.not_found,
        groupId: groupId ?? undefined,
      });

      return jsonError("Group not found.", 404);
    }

    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_DETAIL_GET_UNAUTHORIZED,
        outcome: LogOutcome.failed,
        groupId: groupId ?? undefined,
      });

      return jsonError("You must be logged in to view this group.", 401);
    }

    if (!group.memberIds.includes(currentUser.id)) {
      try {
        await requirePermission(currentUser.id, "View all groups");
      } catch {
        void logHttpAction({
          request,
          actionType: ACTION_TYPES.GROUP_DETAIL_GET_FORBIDDEN,
          outcome: LogOutcome.forbidden,
          groupId: groupId ?? undefined,
          fallbackUserId: currentUser.id,
        });

        return jsonError("You are not a member of this group.", 403);
      }
    }

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_DETAIL_GET,
      outcome: LogOutcome.success,
      groupId: groupId ?? undefined,
      fallbackUserId: currentUser.id,
    });

    return jsonOk({
      group: await mapGroupForResponse(group, currentUser.id),
      dashboard: await getDashboardSummary(currentUser.id),
    });
  } catch (error) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_DETAIL_GET_FAILED,
      outcome: LogOutcome.failed,
      groupId: groupId ?? undefined,
      actionJson: { error: error instanceof Error ? error.message : String(error) },
    });

    return jsonError("Unable to fetch group.", 500);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ groupId: string }> }) {
  let groupId: number | null = null;

  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_DETAIL_PATCH_UNAUTHORIZED,
        outcome: LogOutcome.failed,
        groupId: undefined,
      });

      return jsonError("You must be logged in to update a group.", 401);
    }

    const groupIdParam = (await context.params).groupId;
    groupId = Number(groupIdParam);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_DETAIL_PATCH_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        groupId: undefined,
        actionJson: { groupId: groupIdParam },
        fallbackUserId: actor.id,
      });

      return jsonError("Invalid group id.", 400);
    }

    const body = await request.json();
    const input = createGroupSchema.partial().parse(body);
    const group = await updateGroup(groupId, input, actor.id);

    if (!group) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_DETAIL_PATCH_NOT_FOUND,
        outcome: LogOutcome.not_found,
        groupId: groupId ?? undefined,
        fallbackUserId: actor.id,
      });

      return jsonError("Group not found.", 404);
    }

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_DETAIL_PATCH,
      outcome: LogOutcome.success,
      groupId: groupId ?? undefined,
      fallbackUserId: actor.id,
    });

    return jsonOk({ group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update group.";
    const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 400;

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_DETAIL_PATCH_FAILED,
      outcome: outcomeFromStatus(status),
      groupId: groupId ?? undefined,
      actionJson: { message },
    });

    return jsonError(message, status);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ groupId: string }> }) {
  let groupId: number | null = null;

  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_DETAIL_DELETE_UNAUTHORIZED,
        outcome: LogOutcome.failed,
        groupId: undefined,
      });

      return jsonError("You must be logged in to delete a group.", 401);
    }

    const groupIdParam = (await context.params).groupId;
    groupId = Number(groupIdParam);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_DETAIL_DELETE_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        groupId: undefined,
        actionJson: { groupId: groupIdParam },
        fallbackUserId: actor.id,
      });

      return jsonError("Invalid group id.", 400);
    }

    const deleted = await deleteGroup(groupId, actor.id);
    if (!deleted) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_DETAIL_DELETE_NOT_FOUND,
        outcome: LogOutcome.not_found,
        groupId: groupId ?? undefined,
        fallbackUserId: actor.id,
      });

      return jsonError("Group not found.", 404);
    }

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_DETAIL_DELETE,
      outcome: LogOutcome.success,
      groupId: groupId ?? undefined,
      fallbackUserId: actor.id,
    });

    return jsonOk({ group: deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete group.";
    const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 400;

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_DETAIL_DELETE_FAILED,
      outcome: outcomeFromStatus(status),
      groupId: groupId ?? undefined,
      actionJson: { message },
    });

    return jsonError(message, status);
  }
}

