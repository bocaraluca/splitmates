import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getGroupStats, getGroupById } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const groupId = Number((await context.params).groupId);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return jsonError("Invalid group id.", 400);
  }

  if (!(await getGroupById(groupId))) {
    return jsonError("Group not found.", 404);
  }

  const stats = await getGroupStats(groupId);
  return jsonOk({ stats });
}