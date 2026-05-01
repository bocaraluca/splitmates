import { createGroupSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { mapGroupForResponse } from "@/lib/splitmates/api/group-response";
import {
  deleteGroup,
  getDashboardSummary,
  getGroupById,
  resolveCurrentUser,
  updateGroup,
} from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const groupId = Number((await context.params).groupId);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return jsonError("Invalid group id.", 400);
  }

  const group = getGroupById(groupId);
  if (!group) {
    return jsonError("Group not found.", 404);
  }

  const currentUser = resolveCurrentUser(request);
  if (!currentUser) {
    return jsonError("You must be logged in to view this group.", 401);
  }

  if (!group.memberIds.includes(currentUser.id)) {
    return jsonError("You are not a member of this group.", 403);
  }

  return jsonOk({
    group: mapGroupForResponse(group, currentUser.id),
    dashboard: getDashboardSummary(currentUser.id),
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = resolveCurrentUser(request);
    if (!actor) {
      return jsonError("You must be logged in to update a group.", 401);
    }

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return jsonError("Invalid group id.", 400);
    }

    const body = await request.json();
    const input = createGroupSchema.partial().parse(body);
    const group = updateGroup(groupId, input, actor.id);

    if (!group) {
      return jsonError("Group not found.", 404);
    }

    return jsonOk({ group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update group.";
    return jsonError(message, 400);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = resolveCurrentUser(request);
    if (!actor) {
      return jsonError("You must be logged in to delete a group.", 401);
    }

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return jsonError("Invalid group id.", 400);
    }

    const deleted = deleteGroup(groupId, actor.id);
    if (!deleted) {
      return jsonError("Group not found.", 404);
    }

    return jsonOk({ group: deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete group.";
    return jsonError(message, 400);
  }
}

