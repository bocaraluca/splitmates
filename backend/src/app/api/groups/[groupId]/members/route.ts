import { addGroupMemberSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { mapGroupForResponse } from "@/lib/splitmates/api/group-response";
import {
  addMemberToGroup,
  getUserById,
  getUserRecordByIdentifier,
  removeMemberFromGroup,
  getCurrentUserFromRequest,
} from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_MEMBERS_ADD_UNAUTHORIZED,
        outcome: LogOutcome.failed,
      });

      return jsonError("You must be logged in to add members.", 401);
    }

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_MEMBERS_ADD_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        fallbackUserId: actor.id,
      });

      return jsonError("Invalid group id.", 400);
    }

    const body = await request.json();
    const input = addGroupMemberSchema.parse(body);
    const group = await addMemberToGroup(groupId, input.identifier, actor.id);
    const newMemberRecord = await getUserRecordByIdentifier(input.identifier);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_MEMBERS_ADD,
      outcome: LogOutcome.success,
      fallbackUserId: actor.id,
      actionJson: { groupId, identifier: input.identifier },
    });

    return jsonOk({
      group: await mapGroupForResponse(group, actor.id),
      member: newMemberRecord ? await getUserById(newMemberRecord.id) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add member.";

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_MEMBERS_ADD_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, 400);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_MEMBERS_REMOVE_UNAUTHORIZED,
        outcome: LogOutcome.failed,
      });

      return jsonError("You must be logged in to remove members.", 401);
    }

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_MEMBERS_REMOVE_INVALID_GROUP_ID,
        outcome: LogOutcome.validation_error,
        fallbackUserId: actor.id,
      });

      return jsonError("Invalid group id.", 400);
    }

    const body = await request.json().catch(() => ({}));
    const userId = Number.isInteger(Number(body.userId)) ? Number(body.userId) : null;
    const identifier = typeof body.identifier === "string" ? body.identifier : null;
    const targetUserRecord = identifier ? await getUserRecordByIdentifier(identifier) : null;

    const targetUser = userId
      ? await getUserById(userId)
      : targetUserRecord
        ? await getUserById(targetUserRecord.id)
        : null;

    if (!targetUser) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUP_MEMBERS_REMOVE_NOT_FOUND,
        outcome: LogOutcome.not_found,
        fallbackUserId: actor.id,
        actionJson: { groupId, userId: body.userId ?? null, identifier: body.identifier ?? null },
      });

      return jsonError("The user is not a member of this group.", 404);
    }

    const group = await removeMemberFromGroup(groupId, targetUser.id, actor.id);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_MEMBERS_REMOVE,
      outcome: LogOutcome.success,
      fallbackUserId: actor.id,
      actionJson: { groupId, userId: targetUser.id },
    });

    return jsonOk({
      group: group ? await mapGroupForResponse(group, actor.id) : group,
      removedUser: targetUser,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove member.";

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUP_MEMBERS_REMOVE_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, 400);
  }
}
