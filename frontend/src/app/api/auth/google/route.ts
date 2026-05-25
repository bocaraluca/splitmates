import type { NextRequest } from "next/server";

const BACKEND_BASE_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

export async function GET(_request: NextRequest) {
  return Response.redirect(`${BACKEND_BASE_URL}/api/auth/google`, 302);
}
