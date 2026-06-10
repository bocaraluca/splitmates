import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { getNotifications, markAllAsRead } from "@/lib/splitmates/services/notification-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await getCurrentUserFromRequest(request);
  if (!actor) return jsonError("Unauthorized.", 401);

  const notifications = await getNotifications(actor.id);
  return jsonOk({ notifications });
}

export async function PATCH(request: Request) {
  const actor = await getCurrentUserFromRequest(request);
  if (!actor) return jsonError("Unauthorized.", 401);

  await markAllAsRead(actor.id);
  return jsonOk({ message: "All notifications marked as read." });
}
