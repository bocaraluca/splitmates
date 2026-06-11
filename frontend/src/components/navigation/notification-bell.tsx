"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import { Badge, IconButton } from "@mui/material";
import { fetchFromBackend } from "@/lib/backend-api";
import { getToken } from "@/lib/auth-storage";

export function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const token = getToken();

  const fetchUnread = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchFromBackend<{ notifications: { read: boolean }[] }>("/notifications", { token });
      setUnreadCount(res.notifications.filter((n) => !n.read).length);
    } catch {

    }
  }, [token]);

  useEffect(() => {
    void fetchUnread();
    intervalRef.current = setInterval(() => void fetchUnread(), 30000);

    const handleChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ unread?: number }>).detail;
      if (typeof detail?.unread === "number") {
        setUnreadCount(detail.unread);
      } else {
        void fetchUnread();
      }
    };

    window.addEventListener("splitmates:notifications-changed", handleChanged);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("splitmates:notifications-changed", handleChanged);
    };
  }, [fetchUnread]);

  return (
    <IconButton
      onClick={() => router.push("/notifications")}
      sx={{
        color: "white",
        bgcolor: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.24)",
        width: 44,
        height: 44,
        "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
      }}
    >
      <Badge badgeContent={unreadCount} color="error" max={99}>
        <NotificationsRoundedIcon />
      </Badge>
    </IconButton>
  );
}
