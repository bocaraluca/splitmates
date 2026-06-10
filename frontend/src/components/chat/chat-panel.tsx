"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { io, type Socket } from "socket.io-client";
import { backendSocketUrl, fetchFromBackend, getCurrentClientUserId } from "@/lib/backend-api";
import { getToken, getUsername } from "@/lib/auth-storage";
import type { ActiveUser, ChatHistoryResponse, ChatMessage, User } from "@/lib/types";

type ServerActiveUser = Pick<User, "id" | "username">;

const PAGE_SIZE = 50;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function uniqueMessages(messages: ChatMessage[]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  });
}

function mergeMessages(previous: ChatMessage[], next: ChatMessage[]) {
  return uniqueMessages([...previous, ...next]).sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

function normalizeActiveUsers(users: ServerActiveUser[]): ActiveUser[] {
  return users.map((user) => ({
    userId: user.id,
    username: user.username,
  }));
}

export function ChatPanel({
  groupId,
  groupName,
  fullPage = false,
}: {
  groupId: number;
  groupName: string;
  fullPage?: boolean;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messageIdsRef = useRef(new Set<string>());

  useEffect(() => {
    setIsMounted(true);
    setToken(getToken());
    setCurrentUsername(getUsername());
    setCurrentUserId(getCurrentClientUserId());
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const container = document.getElementById(`chat-scroll-${groupId}`);
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, [groupId]);

  const loadHistory = useCallback(async () => {
    if (!token) {
      setStatusMessage("You need to sign in to view chat.");
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    try {
      const response = await fetchFromBackend<ChatHistoryResponse>(`/groups/${groupId}/chat?page=1&pageSize=${PAGE_SIZE}`, {
        token,
      });

      setMessages(response.messages);
      messageIdsRef.current = new Set(response.messages.map((message) => message.id));
      setPage(response.page);
      setTotalPages(response.totalPages);
      setStatusMessage(null);
      scrollToBottom();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to load chat history.");
    } finally {
      setLoadingHistory(false);
    }
  }, [groupId, scrollToBottom, token]);

  const loadOlderMessages = useCallback(async () => {
    if (!token || loadingMore || page >= totalPages) {
      return;
    }

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await fetchFromBackend<ChatHistoryResponse>(`/groups/${groupId}/chat?page=${nextPage}&pageSize=${PAGE_SIZE}`, {
        token,
      });

      setMessages((previous) => mergeMessages(response.messages, previous));
      response.messages.forEach((message) => messageIdsRef.current.add(message.id));
      setPage(response.page);
      setTotalPages(response.totalPages);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to load older messages.");
    } finally {
      setLoadingMore(false);
    }
  }, [groupId, loadingMore, page, totalPages, token]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!isMounted || !token) {
      return;
    }

    const socketUrl = backendSocketUrl();

    const socket = io(socketUrl, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setStatusMessage(null);
      socket.emit("chat:join", { groupId });
    });

    socket.on("users:active", (payload: { groupId?: number; users?: ServerActiveUser[] }) => {
      if (payload.groupId !== groupId || !Array.isArray(payload.users)) {
        return;
      }
      setActiveUsers(normalizeActiveUsers(payload.users));
    });

    socket.on("user:joined", (payload: { userId?: number; username?: string }) => {
      const userId = payload.userId;
      const username = payload.username;
      if (userId == null || !username) {
        return;
      }

      setActiveUsers((previous) => {
        if (previous.some((user) => user.userId === userId)) return previous;
        return [...previous, { userId, username }];
      });
    });

    socket.on("user:left", (payload: { userId?: number }) => {
      const userId = payload.userId;
      if (userId == null) return;
      setActiveUsers((previous) => previous.filter((user) => user.userId !== userId));
    });

    socket.on("message:new", (message: ChatMessage) => {
      if (!message || message.groupId !== groupId || messageIdsRef.current.has(message.id)) {
        return;
      }
      messageIdsRef.current.add(message.id);
      setMessages((previous) => mergeMessages(previous, [message]));
      scrollToBottom();
    });

    socket.on("message:deleted", (payload: { messageId?: string }) => {
      const messageId = payload.messageId;
      if (!messageId) return;
      
      const targetId = String(messageId);

      messageIdsRef.current.delete(targetId);
      setMessages((previous) => previous.filter((message) => message.id !== targetId));
    });

    socket.on("disconnect", () => {
      setStatusMessage("Chat connection closed.");
    });

    socket.on("connect_error", (err: Error) => {
      const message = err?.message ?? "Unable to reach the backend.";
      setStatusMessage(message);
    });

    socket.on("error", (payload: { message?: string }) => {
      if (payload?.message) {
        setStatusMessage(payload.message);
      }
    });

    return () => {
      socket.emit("chat:leave", { groupId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [groupId, isMounted, scrollToBottom, token]);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    const socket = socketRef.current;

    if (!trimmed || !socket || !socket.connected) {
      return;
    }

    setSending(true);
    socket.emit("chat:message", { groupId, content: trimmed });
    setDraft("");
    setSending(false);
  }, [draft, groupId]);

  const handleDelete = useCallback(async (messageId: string) => {
    const socket = socketRef.current;

    if (socket?.connected) {
      socket.emit("chat:delete", { groupId, messageId });
      messageIdsRef.current.delete(messageId);
      setMessages((previous) => previous.filter((message) => message.id !== messageId));
      return;
    }

    if (!token) {
      return;
    }

    try {
      await fetchFromBackend(`/groups/${groupId}/chat/${messageId}`, {
        method: "DELETE",
        token,
      });

      messageIdsRef.current.delete(messageId);
      setMessages((previous) => previous.filter((message) => message.id !== messageId));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to delete message.");
    }
  }, [groupId, token]);

  const onlineUsersLabel = useMemo(() => {
    if (activeUsers.length === 0) {
      return "No one is online right now";
    }
    return `${activeUsers.length} online`;
  }, [activeUsers.length]);

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: fullPage ? 0 : 3,
        background: "transparent",
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <CardContent 
        sx={{ 
          p: fullPage ? { xs: 1, md: 2 } : { xs: 1.6, md: 2.2 }, 
          "&:last-child": { pb: fullPage ? { xs: 1, md: 2 } : { xs: 1.6, md: 2.2 } },
          display: "flex", 
          flexDirection: "column", 
          flex: 1,
          minHeight: 0,
          width: "100%",
        }}
      >
        <Stack spacing={2} sx={{ 
            flex: 1,
            minHeight: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
         }}>
          
          {!fullPage && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em" }}>
                <Box component="span" sx={{ color: "#f38ea4" }}>
                  Chat
                </Box>
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 800, mt: 0.5, letterSpacing: "-0.01em" }}>
                 <Box component="span" sx={{ color: "#73c3e8" }}>
                  {groupName}
                </Box>
              </Typography>
            </Box>
          )}

          {statusMessage ? <Alert severity="info" sx={{ borderRadius: 3 }}>{statusMessage}</Alert> : null}

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            <Chip
              label={onlineUsersLabel}
              sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontWeight: 600, border: "1px solid rgba(255,255,255,0.12)" }}
            />
            {activeUsers.slice(0, 6).map((user) => (
              <Chip
                key={user.userId}
                label={user.username}
                variant="outlined"
                sx={{ borderColor: "rgba(232,62,168,0.5)", color: "#e83ea8", fontWeight: 600, bgcolor: "rgba(232,62,168,0.08)" }}
              />
            ))}
          </Box>

          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

          <Box
            id={`chat-scroll-${groupId}`}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              pr: 0.5,
              width: "100%",
              "&::-webkit-scrollbar": { width: "6px" },
              "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "10px" },
            }}
          >
            {page < totalPages ? (
              <Button 
                onClick={() => void loadOlderMessages()} 
                disabled={loadingMore} 
                variant="text" 
                sx={{ alignSelf: "center", color: "#DF449A", borderRadius: 4, textTransform: "none", fontWeight: 600 }}
              >
                {loadingMore ? "Loading earlier messages..." : "Load earlier messages"}
              </Button>
            ) : null}

            {loadingHistory ? (
              <Typography sx={{ color: "text.secondary", textAlign: "center", mt: 4 }}>Loading chat history...</Typography>
            ) : messages.length === 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.6 }}>
                <Typography sx={{ color: "#351A5A", fontWeight: 600 }}>No messages yet.</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Start the conversation!</Typography>
              </Box>
            ) : (
              messages.map((message) => {
                const isOwnMessage = currentUserId !== null && message.userId === currentUserId;
                return (
                  <Box
                    key={message.id}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isOwnMessage ? "flex-end" : "flex-start",
                      width: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: { xs: "90%", md: "75%" },
                        borderRadius: "20px",
                        borderBottomRightRadius: isOwnMessage ? "4px" : "20px",
                        borderBottomLeftRadius: isOwnMessage ? "20px" : "4px",
                        px: 2,
                        py: 1.2,
                        // Update: Translucent glass bubble for other users
                        bgcolor: isOwnMessage ? "#e83ea8" : "rgba(255,255,255,0.09)",
                        backdropFilter: isOwnMessage ? "none" : "blur(8px)",
                        border: isOwnMessage ? "none" : "1px solid rgba(255,255,255,0.12)",
                        boxShadow: isOwnMessage
                          ? "0 4px 16px rgba(232,62,168,0.3)"
                          : "0 2px 8px rgba(0,0,0,0.2)",
                        color: "white",
                        width: "fit-content",
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5, flexWrap: "wrap" }}>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.85rem", color: isOwnMessage ? "rgba(255,255,255,0.9)" : "#a78bfa" }}>
                          {message.username}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.45)", fontSize: "0.7rem" }}>
                          {formatTime(message.createdAt)}
                        </Typography>
                        {isOwnMessage ? (
                          <IconButton 
                            size="small" 
                            onClick={() => void handleDelete(message.id)} 
                            aria-label="Delete message"
                            sx={{ color: "rgba(255,255,255,0.7)", p: 0.2, "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.1)" } }}
                          >
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        ) : null}
                      </Stack>
                      <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.5, fontSize: "0.95rem" }}>
                        {message.content}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>

          {/* Input Area */}
          <Stack 
            direction="row" 
            spacing={1.5} 
            sx={{ 
              pt: 1.5,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              alignItems: "flex-end"
            }}
          >
            <TextField
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              multiline
              minRows={1}
              maxRows={4}
              placeholder="Write a message..."
              fullWidth
              variant="outlined"
              
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "24px",
                  bgcolor: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "white",
                  "& fieldset": { border: "none" },
                  "&:hover fieldset": { border: "none" },
                  "&.Mui-focused fieldset": { border: "1px solid #e83ea8" },
                  "& input::placeholder, & textarea::placeholder": { color: "rgba(255,255,255,0.35)" },
                },
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              variant="contained"
              onClick={() => void handleSend()}
              disabled={sending || draft.trim().length === 0}
              sx={{ 
                borderRadius: "50%",
                minWidth: "48px",
                width: "48px",
                height: "48px",
                p: 0,
                bgcolor: "#DF449A",
                color: "#fff",
                boxShadow: "0 4px 12px rgba(223, 68, 154, 0.3)",
                "&:hover": { bgcolor: "#c93587" },
                "&.Mui-disabled": { bgcolor: "rgba(223, 68, 154, 0.3)", color: "rgba(255,255,255,0.8)" }
              }}
            >
              <SendRoundedIcon sx={{ ml: 0.5 }} />
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}