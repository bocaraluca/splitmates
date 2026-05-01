import { jsonOk } from "@/lib/splitmates/api/http";
import { getGeneratorStatus } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET() {
  return jsonOk({ status: getGeneratorStatus() });
}

