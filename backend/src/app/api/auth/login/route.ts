import { loginSchema } from "@/lib/splitmates/validation/schemas";
import { formatValidationError } from "@/lib/splitmates/validation/errors";
import { jsonError, jsonSessionOk } from "@/lib/splitmates/api/http";
import { loginUser } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);
    const session = loginUser(input);

    return jsonSessionOk(session, session.token);
  } catch (error) {
    const message = formatValidationError(error, "Unable to log in.");
    return jsonError(message, 400);
  }
}

