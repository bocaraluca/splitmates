import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { markAsRead, deleteNotification } from "@/lib/splitmates/services/notification-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUserFromRequest(request);
  if (!actor) return jsonError("Unauthorized.", 401);

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) return jsonError("Invalid notification id.", 400);

  await markAsRead(id, actor.id);
  return jsonOk({ message: "Notification marked as read." });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUserFromRequest(request);
  if (!actor) return jsonError("Unauthorized.", 401);

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) return jsonError("Invalid notification id.", 400);

  await deleteNotification(id, actor.id);
  return jsonOk({ message: "Notification deleted." });
}
