import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const hostname = host.split(":")[0];
  return Response.redirect(`https://${hostname}:4000/api/auth/google`, 302);
}
