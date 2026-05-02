import { loginSchema } from "@/lib/splitmates/validation/schemas";
import { formatValidationError } from "@/lib/splitmates/validation/errors";
import { jsonError, jsonSessionOk } from "@/lib/splitmates/api/http";
import { loginUser } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);
    const session = await loginUser(input);

    return jsonSessionOk(session, session.token);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }

    const message = formatValidationError(error, "Unable to log in.");

    if (message === "Invalid login credentials.") {
      return jsonError(message, 401);
    }

    return jsonError(message, 400);
  }
}