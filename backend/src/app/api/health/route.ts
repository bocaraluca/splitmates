import { jsonOk } from "@/lib/splitmates/api/http";
import { getHealthSnapshot } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET() {
  return jsonOk({ ok: true, ...getHealthSnapshot() });
}

