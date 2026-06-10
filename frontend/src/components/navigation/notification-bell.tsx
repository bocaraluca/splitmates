"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import { Badge, IconButton } from "@mui/material";
import { fetchFromBackend } from "@/lib/backend-api";
import { getToken } from "@/lib/auth-storage";

interface Notification {
  id: number;
  read: boolean;
}

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const token = getToken();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchFromBackend<{ notifications: Notification[] }>("/notifications", { token });
      setNotifications(res.notifications);
    } catch {
      // silent fail
    }
  }, [token]);

  useEffect(() => {
    void fetchNotifications();
    intervalRef.current = setInterval(() => void fetchNotifications(), 30000);

    const handleChanged = () => { void fetchNotifications(); };

    window.addEventListener("splitmates:notifications-changed", handleChanged);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("splitmates:notifications-changed", handleChanged);
    };
  }, [fetchNotifications]);

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
