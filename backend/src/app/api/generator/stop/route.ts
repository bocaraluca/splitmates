import { jsonOk } from "@/lib/splitmates/api/http";
import { stopGenerator } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function POST() {
  return jsonOk({ status: stopGenerator() });
}

