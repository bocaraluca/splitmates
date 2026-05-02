import { subscribeToEvents } from "@/lib/splitmates";

export const runtime = "nodejs";

export async function GET() {
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
    },
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
      }

      unsubscribe();
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


