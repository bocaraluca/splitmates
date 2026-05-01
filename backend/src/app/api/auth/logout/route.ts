import { jsonClearSession, jsonError } from "@/lib/splitmates/api/http";
import { clearSessionToken, resolveSessionToken } from "@/lib/splitmates/services/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const token = resolveSessionToken(request);
    clearSessionToken(token);
    return jsonClearSession();
  } catch {
    return jsonError("Unable to log out.", 400);
  }
}
