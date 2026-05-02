import type { ApiEventPayload } from "../model/types";
import { getState } from "@/lib/splitmates/core/state";
import { broadcastWebSocketEvent } from "./websocket";

export function emitEvent(type: string, data: unknown) {
  const payload: ApiEventPayload = {
    type,
    timestamp: new Date().toISOString(),
    data,
  };

  getState().emitter.emit("change", payload);
  broadcastWebSocketEvent(payload);
}

export function subscribeToEvents(listener: (payload: ApiEventPayload) => void) {
  const state = getState();
  const handler = (payload: ApiEventPayload) => listener(payload);
  state.emitter.on("change", handler);

  return () => {
    state.emitter.off("change", handler);
  };
}


