import { jsonClearSession, jsonError } from "@/lib/splitmates/api/http";
import { revokeSessionToken, readSessionTokenFromRequest } from "@/lib/splitmates/services/auth/session-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const token = readSessionTokenFromRequest(request);
    revokeSessionToken(token);
    return jsonClearSession();
  } catch {
    return jsonError("Unable to log out.", 400);
  }
}

