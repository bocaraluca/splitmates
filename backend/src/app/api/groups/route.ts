import { createGroupSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { mapGroupForResponse } from "@/lib/splitmates/api/group-response";
import { createGroup, getGroupsForUserId, getCurrentUserFromRequest } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await getCurrentUserFromRequest(request);
  if (!currentUser) {
    return jsonError("You must be logged in to view groups.", 401);
  }

  const groupsRaw = await getGroupsForUserId(currentUser.id);
  const groups = await Promise.all(
    groupsRaw.map((group: any) => mapGroupForResponse(group, currentUser.id)),
  );

  return jsonOk({ groups });
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      return jsonError("You must be logged in to create a group.", 401);
    }

    const body = await request.json();
    const input = createGroupSchema.parse(body);
    const group = await createGroup(input, actor.id);

    return jsonOk({ group: await mapGroupForResponse(group, actor.id) }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create group.";
    return jsonError(message, 400);
  }
}
