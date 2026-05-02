import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getDashboardSummary, getUsers, getCurrentUserFromRequest } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessionUser = await getCurrentUserFromRequest(request);
  const fallbackUser = sessionUser ?? (await getUsers())[0] ?? null;

  if (!fallbackUser) {
    return jsonError("No users are available.", 404);
  }

  try {
    return jsonOk(await getDashboardSummary(fallbackUser.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load dashboard.";
    return jsonError(message, 400);
  }
}
