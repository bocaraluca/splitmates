import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { leaveGroup, getCurrentUserFromRequest } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return jsonError("You must be logged in to leave a group.", 401);
    }

    const groupId = Number((await context.params).groupId);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return jsonError("Invalid group id.", 400);
    }

    const group = await leaveGroup(groupId, currentUser.id);

    return jsonOk({ group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to leave group.";
    return jsonError(message, 400);
  }
}

