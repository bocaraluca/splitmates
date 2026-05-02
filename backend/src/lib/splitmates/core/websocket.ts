import type { ApiEventPayload } from "../model/types";

declare global {
  var __splitmatesBroadcastWebSocket: ((payload: ApiEventPayload) => void) | undefined;
}

export function broadcastWebSocketEvent(payload: ApiEventPayload) {
  globalThis.__splitmatesBroadcastWebSocket?.(payload);
}

