"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { backendWebSocketUrl, syncPendingBackendRequests } from "@/lib/backend-api";

function purgeAuthFromOfflineQueue() {
  if (typeof window === "undefined") return;
  const key = "splitmates.offline.queue";
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const queue = JSON.parse(raw) as Array<{ path: string }>;
    const cleaned = queue.filter((item) => {
      const first = item.path.split("?")[0].split("/").filter(Boolean)[0];
      return first !== "auth" && first !== "notifications";
    });
    localStorage.setItem(key, JSON.stringify(cleaned));
  } catch {}
}

function emitBackendUpdate(detail: unknown) {
  window.dispatchEvent(new CustomEvent("splitmates:backend-update", { detail }));
}

export function BackendSyncProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const periodicSyncTimerRef = useRef<number | null>(null);
  const offlineRef = useRef(typeof window !== "undefined" ? !window.navigator.onLine : false);
  const intentionalCloseRef = useRef(false);
  const disposedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    disposedRef.current = false;
    purgeAuthFromOfflineQueue();

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const stopPeriodicSync = () => {
      if (periodicSyncTimerRef.current !== null) {
        window.clearInterval(periodicSyncTimerRef.current);
        periodicSyncTimerRef.current = null;
      }
    };

    const startPeriodicSync = () => {
      if (periodicSyncTimerRef.current !== null) {
        return;
      }

      periodicSyncTimerRef.current = window.setInterval(() => {
        syncBackend("sync.periodic");
      }, 5000);
    };

    const markOffline = () => {
      offlineRef.current = true;
      stopPeriodicSync();
    };

    const markOnline = () => {
      offlineRef.current = false;
      startPeriodicSync();
    };

    const syncBackend = (type: string) => {
      void syncPendingBackendRequests().then((result) => {
        if (disposedRef.current) {
          return;
        }

        if (result.synced > 0 || result.remaining > 0) {
          emitBackendUpdate({ type, result });
        }
      });
    };

    const closeSocket = () => {
      socketRef.current?.close();
    };

    const connect = () => {
      const socketState = socketRef.current?.readyState;
      if (disposedRef.current || socketState === WebSocket.OPEN || socketState === WebSocket.CONNECTING) {
        return;
      }

      clearReconnectTimer();
      socketRef.current = new WebSocket(backendWebSocketUrl("/ws"));

      socketRef.current.addEventListener("open", () => {
        if (disposedRef.current) {
          return;
        }

        markOnline();
        void syncPendingBackendRequests().then((result) => {
          if (disposedRef.current) {
            return;
          }

          emitBackendUpdate({ type: "ws.connected", result });
        });
      });

      socketRef.current.addEventListener("message", (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as { type?: unknown };
          if (parsed && typeof parsed === "object" && parsed.type === "connected") {
            return;
          }
          emitBackendUpdate(parsed);
        } catch {
          emitBackendUpdate({ type: "ws.message" });
        }
      });

      socketRef.current.addEventListener("close", () => {
        if (disposedRef.current) {
          return;
        }

        const wasIntentional = intentionalCloseRef.current;
        intentionalCloseRef.current = false;
        socketRef.current = null;
        stopPeriodicSync();
        markOffline();

        if (!wasIntentional) {
          reconnectTimerRef.current = window.setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, 2000);
        }
      });

      socketRef.current.addEventListener("error", () => {
        closeSocket();
      });
    };

    const handleOnline = () => {
      if (offlineRef.current) {
        offlineRef.current = false;
      }

      clearReconnectTimer();

      if (socketRef.current?.readyState !== WebSocket.OPEN && socketRef.current?.readyState !== WebSocket.CONNECTING) {
        connect();
      }

      markOnline();
      syncBackend("browser.online");
    };

    const handleOffline = () => {
      clearReconnectTimer();
      markOffline();
      intentionalCloseRef.current = true;
      closeSocket();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (offlineRef.current) {
      markOffline();
    } else {
      connect();
      markOnline();
      syncBackend("sync.bootstrap");
    }

    return () => {
      disposedRef.current = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      clearReconnectTimer();
      stopPeriodicSync();

      closeSocket();
      socketRef.current = null;
    };
  }, []);

  return <>{children}</>;
}