"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import {
  Box, Button, Card, CardContent, Container,
  Divider, Stack, Typography,
} from "@mui/material";
import { AppNavbar } from "@/components/navigation/app-navbar";
import { fetchFromBackend } from "@/lib/backend-api";
import { getToken } from "@/lib/auth-storage";

interface Notification {
  id: number;
  type: "group_added" | "expense_added" | "payment_request" | "payment_received" | "payment_failed";
  title: string;
  body: string;
  read: boolean;
  groupId: number | null;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotifIcon({ type }: { type: Notification["type"] }) {
  const sx = { fontSize: 22 };
  if (type === "group_added") return <GroupRoundedIcon sx={{ ...sx, color: "#6f29c6" }} />;
  if (type === "expense_added") return <ReceiptLongRoundedIcon sx={{ ...sx, color: "#e74c3c" }} />;
  if (type === "payment_request") return <RequestQuoteRoundedIcon sx={{ ...sx, color: "#f07a2b" }} />;
  if (type === "payment_received") return <PaymentsRoundedIcon sx={{ ...sx, color: "#27ae60" }} />;
  if (type === "payment_failed") return <ErrorOutlineRoundedIcon sx={{ ...sx, color: "#e74c3c" }} />;
  return <NotificationsRoundedIcon sx={sx} />;
}

export function NotificationsPage() {
  const router = useRouter();
  const [token] = useState<string | null>(getToken);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchFromBackend<{ notifications: Notification[] }>("/notifications", { token });
      setNotifications(res.notifications);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  function dispatchCountChanged(notifications: Notification[]) {
    const unread = notifications.filter((n) => !n.read).length;
    window.dispatchEvent(new CustomEvent("splitmates:notifications-changed", { detail: { unread } }));
  }

  async function handleMarkAllRead() {
    if (!token) return;
    try {
      await fetchFromBackend("/notifications", { method: "PATCH", token });
      const updated = notifications.map((n) => ({ ...n, read: true }));
      setNotifications(updated);
      dispatchCountChanged(updated);
    } catch {
      // silent fail
    }
  }

  async function handleMarkRead(id: number) {
    if (!token) return;
    const updated = notifications.map((n) => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    dispatchCountChanged(updated);
    try {
      await fetchFromBackend(`/notifications/${id}`, { method: "PATCH", token });
    } catch {
      // silent fail
    }
  }

  function handleNotifClick(notif: Notification) {
    void handleMarkRead(notif.id);
    if (notif.groupId) {
      const tab = notif.type === "payment_request" || notif.type === "payment_received" || notif.type === "payment_failed"
        ? "?tab=settlements"
        : "";
      router.push(`/groups/${notif.groupId}${tab}`);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(96deg, rgba(248,233,255,0.92) 0%, rgba(238,225,255,0.9) 52%, rgba(227,246,255,0.9) 100%)" }}>
      <AppNavbar />
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={3}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="h3" sx={{ fontWeight: 900 }}>
              Notifications
              {unreadCount > 0 && (
                <Box component="span" sx={{ ml: 1.5, fontSize: 16, bgcolor: "#e74c3c", color: "white", px: 1, py: 0.3, borderRadius: 999, fontWeight: 700, verticalAlign: "middle" }}>
                  {unreadCount} new
                </Box>
              )}
            </Typography>
            {unreadCount > 0 && (
              <Button
                onClick={() => void handleMarkAllRead()}
                sx={{ fontWeight: 700, textTransform: "none", color: "#6f29c6" }}
              >
                Mark all read
              </Button>
            )}
          </Stack>

          <Card sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.88)", overflow: "hidden" }}>
            {loading ? (
              <CardContent sx={{ textAlign: "center", py: 5 }}>
                <Typography sx={{ color: "text.secondary" }}>Loading...</Typography>
              </CardContent>
            ) : notifications.length === 0 ? (
              <CardContent sx={{ textAlign: "center", py: 6 }}>
                <Typography sx={{ fontSize: 48 }}>🔔</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 20, mt: 1 }}>No notifications yet</Typography>
              </CardContent>
            ) : (
              notifications.map((notif, index) => (
                <Box key={notif.id}>
                  <Box
                    onClick={() => handleNotifClick(notif)}
                    sx={{
                      px: 2.5,
                      py: 2,
                      cursor: notif.groupId ? "pointer" : "default",
                      bgcolor: notif.read ? "transparent" : "rgba(111,41,198,0.05)",
                      "&:hover": { bgcolor: notif.groupId ? "rgba(111,41,198,0.08)" : notif.read ? "transparent" : "rgba(111,41,198,0.05)" },
                      transition: "background 0.15s",
                    }}
                  >
                    <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          bgcolor: "rgba(111,41,198,0.08)",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <NotifIcon type={notif.type} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                          <Typography sx={{ fontWeight: notif.read ? 600 : 800, fontSize: 15 }}>
                            {notif.title}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0, ml: 1 }}>
                            <Typography variant="caption" sx={{ color: "text.disabled", whiteSpace: "nowrap" }}>
                              {timeAgo(notif.createdAt)}
                            </Typography>
                            {!notif.read && (
                              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#6f29c6", flexShrink: 0 }} />
                            )}
                          </Stack>
                        </Stack>
                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4, lineHeight: 1.5 }}>
                          {notif.body}
                        </Typography>
                        {notif.groupId && !notif.read && (
                          <Typography variant="caption" sx={{ color: "#6f29c6", fontWeight: 700, mt: 0.5, display: "block" }}>
                            Tap to view →
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Box>
                  {index < notifications.length - 1 && <Divider />}
                </Box>
              ))
            )}
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
