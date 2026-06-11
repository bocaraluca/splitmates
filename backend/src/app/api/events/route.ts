import { subscribeToEvents, getCurrentUserFromRequest } from "@/lib/splitmates";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";
import { jsonError } from "@/lib/splitmates/api/http";

export const runtime = "nodejs";

export async function GET(request: Request = new Request("http://localhost/api/events")) {
  const currentUser = await getCurrentUserFromRequest(request);

  if (!currentUser) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.EVENTS_STREAM_UNAUTHORIZED,
      outcome: LogOutcome.failed,
    });
    return jsonError("Unauthorized to perform this action.", 401);
  }

  let unsubscribe = () => {};
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode("retry: 2000\n\n"));

      unsubscribe = subscribeToEvents((payload) => {
        controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(payload)}\n\n`));
      });

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
      }, 15000);

      void logHttpAction({
        request,
        actionType: ACTION_TYPES.EVENTS_STREAM_CONNECT,
        outcome: LogOutcome.success,
      });
    },
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
      }

      unsubscribe();

      void logHttpAction({
        request,
        actionType: ACTION_TYPES.EVENTS_STREAM_DISCONNECT,
        outcome: LogOutcome.success,
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
