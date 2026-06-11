"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import GppBadRoundedIcon from "@mui/icons-material/GppBadRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  Box, Button, Card, CardContent, Container,
  Divider, IconButton, Stack, Tooltip, Typography,
} from "@mui/material";
import { AppNavbar } from "@/components/navigation/app-navbar";
import { fetchFromBackend } from "@/lib/backend-api";
import { getToken } from "@/lib/auth-storage";

interface Notification {
  id: number;
  type: "group_added" | "expense_added" | "payment_request" | "payment_received" | "payment_failed" | "chat_message" | "suspicious_user";
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
  if (type === "chat_message") return <ChatRoundedIcon sx={{ ...sx, color: "#a78bfa" }} />;
  if (type === "suspicious_user") return <GppBadRoundedIcon sx={{ ...sx, color: "#ef4444" }} />;
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

    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    dispatchCountChanged(updated);
    try {
      await fetchFromBackend(`/notifications/${id}`, { method: "DELETE", token });
    } catch {

    }
  }

  async function handleDeleteAll() {
    if (!token) return;
    setNotifications([]);
    dispatchCountChanged([]);
    try {
      await fetchFromBackend("/notifications", { method: "DELETE", token });
    } catch {

    }
  }

  async function handleMarkRead(id: number) {
    if (!token) return;
    const updated = notifications.map((n) => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    try {
      await fetchFromBackend(`/notifications/${id}`, { method: "PATCH", token });
    } catch {

    }
    dispatchCountChanged(updated);
  }

  async function handleNotifClick(notif: Notification) {
    await handleMarkRead(notif.id);
    if (notif.groupId) {
      if (notif.type === "chat_message") {
        router.push(`/groups/${notif.groupId}/chat`);
      } else {
        const tab = notif.type === "payment_request" || notif.type === "payment_received" || notif.type === "payment_failed"
          ? "?tab=settlements"
          : "";
        router.push(`/groups/${notif.groupId}${tab}`);
      }
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a0533 0%, #2d0a4e 40%, #0f1a3d 100%)", backgroundAttachment: "fixed" }}>
      <AppNavbar />
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={3}>
          <Stack
            direction="row"
            sx={{
              alignItems: { xs: "flex-start", md: "center" },
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1.5,
            }}
          >
            <Typography variant="h3" sx={{ fontWeight: 900, fontSize: { xs: 28, md: 36 } }}>
              Notifications
              {unreadCount > 0 && (
                <Box component="span" sx={{ ml: 1.5, fontSize: 14, bgcolor: "#e74c3c", color: "white", px: 1, py: 0.3, borderRadius: 999, fontWeight: 700, verticalAlign: "middle" }}>
                  {unreadCount} new
                </Box>
              )}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              {notifications.length > 0 && unreadCount > 0 && (
                <Button
                  onClick={() => void handleMarkAllRead()}
                  sx={{ fontWeight: 700, textTransform: "none", color: "#a78bfa", fontSize: { xs: 13, md: 14 } }}
                >
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  onClick={() => void handleDeleteAll()}
                  sx={{ fontWeight: 700, textTransform: "none", color: "#e74c3c", fontSize: { xs: 13, md: 14 } }}
                  startIcon={<DeleteOutlineRoundedIcon />}
                >
                  Delete all
                </Button>
              )}
            </Stack>
          </Stack>

          <Card sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
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
                    onClick={() => void handleNotifClick(notif)}
                    sx={{
                      px: 2.5,
                      py: 2,
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      bgcolor: notif.read ? "transparent" : "rgba(167,139,250,0.08)",
                      "&:hover": { bgcolor: "rgba(167,139,250,0.12)" },
                      transition: "background 0.15s",
                    }}
                  >
                    <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          bgcolor: "rgba(167,139,250,0.12)",
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
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0, ml: 1 }}>
                            <Typography variant="caption" sx={{ color: "text.disabled", whiteSpace: "nowrap" }}>
                              {timeAgo(notif.createdAt)}
                            </Typography>
                            {!notif.read && (
                              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#a78bfa", flexShrink: 0 }} />
                            )}
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); void handleDelete(notif.id); }}
                                sx={{ color: "text.disabled", "&:hover": { color: "#e74c3c" } }}
                              >
                                <DeleteOutlineRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4, lineHeight: 1.5 }}>
                          {notif.body}
                        </Typography>
                        {notif.groupId && !notif.read && (
                          <Typography variant="caption" sx={{ color: "#a78bfa", fontWeight: 700, mt: 0.5, display: "block" }}>
                            Tap to view →
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Box>
                  {index < notifications.length - 1 && <Divider sx={{ borderColor: "rgba(255,255,255,0.07)" }} />}
                </Box>
              ))
            )}
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
