import { signupSchema } from "@/lib/splitmates/validation/schemas";
import { formatValidationError } from "@/lib/splitmates/validation/errors";
import { jsonError, jsonSessionOk } from "@/lib/splitmates/api/http";
import { signupUser } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = signupSchema.parse(body);
    const session = signupUser({
      username: input.username,
      email: input.email,
      password: input.password,
    });

    return jsonSessionOk(session, session.token, 201);
  } catch (error) {
    const message = formatValidationError(error, "Unable to sign up.");
    return jsonError(message, 400);
  }
}

