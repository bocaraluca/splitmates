import type { NextRequest } from "next/server";

const BACKEND_BASE_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

type RouteContext = { params: Promise<{ path: string[] }> };

async function forwardRequest(request: NextRequest, pathSegments: string[]) {
  const backendUrl = new URL(BACKEND_BASE_URL);
  backendUrl.pathname = ["api", ...pathSegments].join("/");
  backendUrl.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("accept", headers.get("accept") ?? "application/json");

  const shouldSendBody = request.method !== "GET" && request.method !== "HEAD";
  const body = shouldSendBody ? request.body : undefined;

  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
      // @ts-expect-error duplex required for streaming body in Node
      duplex: "half",
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");
    responseHeaders.delete("content-length");

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown upstream error";
    return Response.json(
      {
        error: "Backend server is unreachable.",
        code: "BACKEND_UNREACHABLE",
        detail: errorMessage,
      },
      { status: 503 },
    );
  }
}

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return forwardRequest(request, path);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
export const OPTIONS = handle;
