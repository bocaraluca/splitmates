import { createGroupSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { createGroup, getUsers, listGroupsForUserId, resolveCurrentUser } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = resolveCurrentUser(request);
  if (!currentUser) {
    return jsonError("You must be logged in to view groups.", 401);
  }

  const groups = listGroupsForUserId(currentUser.id).map((group) => ({
    ...group,
    members: group.memberIds.map((memberId) => getUsers().find((user) => user.id === memberId) ?? null),
    admins: group.adminIds.map((adminId) => getUsers().find((user) => user.id === adminId) ?? null),
    isMember: true,
    isAdmin: group.adminIds.includes(currentUser.id),
  }));

  return jsonOk({ groups });
}

export async function POST(request: Request) {
  try {
    const actor = resolveCurrentUser(request);
    if (!actor) {
      return jsonError("You must be logged in to create a group.", 401);
    }

    const body = await request.json();
    const input = createGroupSchema.parse(body);
    const group = createGroup(input, actor.id);

    return jsonOk({ group }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create group.";
    return jsonError(message, 400);
  }
}

