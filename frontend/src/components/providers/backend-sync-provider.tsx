"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Alert, Box } from "@mui/material";
import { backendWebSocketUrl, syncPendingBackendRequests } from "@/lib/backend-api";

function emitBackendUpdate(detail: unknown) {
  window.dispatchEvent(new CustomEvent("splitmates:backend-update", { detail }));
}

const OFFLINE_BANNER_TEXT = "You are offline. Changes will be saved locally until the connection is back.";

export function BackendSyncProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const periodicSyncTimerRef = useRef<number | null>(null);
  const offlineRef = useRef(typeof window !== "undefined" ? !window.navigator.onLine : false);
  const intentionalCloseRef = useRef(false);
  const disposedRef = useRef(false);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return !window.navigator.onLine ? OFFLINE_BANNER_TEXT : null;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    disposedRef.current = false;

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
      setOfflineMessage(OFFLINE_BANNER_TEXT);
      stopPeriodicSync();
    };

    const markOnline = () => {
      offlineRef.current = false;
      setOfflineMessage(null);
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

  return (
    <>
      {offlineMessage ? (
        <Box sx={{ position: "sticky", top: 0, zIndex: 1500 }} role="status" aria-live="polite">
          <Alert
            severity="error"
            variant="filled"
            sx={{
              borderRadius: 0,
              justifyContent: "center",
              alignItems: "center",
              fontWeight: 700,
              boxShadow: "0 10px 24px rgba(0, 0, 0, 0.12)",
            }}
          >
            {offlineMessage}
          </Alert>
        </Box>
      ) : null}
      {children}
    </>
  );
}