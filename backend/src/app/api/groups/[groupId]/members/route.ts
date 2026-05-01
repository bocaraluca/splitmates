import { addGroupMemberSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { mapGroupForResponse } from "@/lib/splitmates/api/group-response";
import {
  addMemberToGroup,
  getUserById,
  getUserRecordByIdentifier,
  removeMemberFromGroup,
  resolveCurrentUser,
} from "@/lib/splitmates";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = resolveCurrentUser(request);
    if (!actor) {
      return jsonError("You must be logged in to add members.", 401);
    }

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return jsonError("Invalid group id.", 400);
    }

    const body = await request.json();
    const input = addGroupMemberSchema.parse(body);
    const group = addMemberToGroup(groupId, input.identifier, actor.id);
    const newMemberRecord = getUserRecordByIdentifier(input.identifier);

    return jsonOk({
      group: mapGroupForResponse(group, actor.id),
      member: newMemberRecord ? getUserById(newMemberRecord.id) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add member.";
    return jsonError(message, 400);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = resolveCurrentUser(request);
    if (!actor) {
      return jsonError("You must be logged in to remove members.", 401);
    }

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return jsonError("Invalid group id.", 400);
    }

    const body = await request.json().catch(() => ({}));
    const userId = Number.isInteger(Number(body.userId)) ? Number(body.userId) : null;
    const identifier = typeof body.identifier === "string" ? body.identifier : null;
    const targetUserRecord = identifier ? getUserRecordByIdentifier(identifier) : null;
    const targetUser = userId ? getUserById(userId) : targetUserRecord ? getUserById(targetUserRecord.id) : null;

    if (!targetUser) {
      return jsonError("The user is not a member of this group.", 404);
    }

    const group = removeMemberFromGroup(groupId, targetUser.id, actor.id);
    return jsonOk({ group: group ? mapGroupForResponse(group, actor.id) : group, removedUser: targetUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove member.";
    return jsonError(message, 400);
  }
}

