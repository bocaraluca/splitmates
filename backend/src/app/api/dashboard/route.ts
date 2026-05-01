import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getDashboardSummary, getUsers, resolveCurrentUser } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = resolveCurrentUser(request) ?? getUsers()[0] ?? null;
  if (!currentUser) {
    return jsonError("No users are available.", 404);
  }

  try {
    return jsonOk(getDashboardSummary(currentUser.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load dashboard.";
    return jsonError(message, 400);
  }
}

