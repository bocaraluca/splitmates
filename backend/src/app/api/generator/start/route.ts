import { generatorSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { startGenerator } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = generatorSchema.parse(body);
    const status = await startGenerator(input.groupId ?? null);
    return jsonOk({ status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start fake expense generation.";
    return jsonError(message, 400);
  }
}


