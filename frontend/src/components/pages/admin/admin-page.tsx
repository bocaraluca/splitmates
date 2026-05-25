"use client";

import { useCallback, useEffect, useState } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { AppNavbar } from "@/components/navigation/app-navbar";
import { fetchFromBackend } from "@/lib/backend-api";
import { DEFAULT_USERNAME, getRole, getToken, getUsername } from "@/lib/auth-storage";
import type {
  AdminLogEntry,
  AdminLogsResponse,
  AdminOverview,
  AdminSuspiciousResponse,
  AppStatsResult,
} from "@/lib/types";

const ADMIN_ROLES = ["admin", "user"] as const;
const ADMIN_TABS = ["management", "suspicious", "performance"] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatActionTypeLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatOutcomeLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AdminSectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Box sx={{ pb: 1.5, borderBottom: "1px solid rgba(23,49,84,0.13)" }}>
      <Typography variant="h3" sx={{ fontSize: { xs: 24, md: 34 }, fontWeight: 900, lineHeight: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ mt: 0.75, color: "text.secondary" }}>{subtitle}</Typography>
    </Box>
  );
}

function ManagementTab({
  overview,
  loading,
  currentUsername,
  roleDrafts,
  savingRoleUserId,
  onRoleChange,
  onUpdateUserRole,
  onDeleteUser,
  onDeleteGroup,
  onRemoveGroupAdmin,
}: {
  overview: AdminOverview | null;
  loading: boolean;
  currentUsername: string;
  roleDrafts: Record<number, string>;
  savingRoleUserId: number | null;
  onRoleChange: (userId: number, nextRole: string) => void;
  onUpdateUserRole: (userId: number, username: string, currentRole: string) => void;
  onDeleteUser: (userId: number, username: string) => void;
  onDeleteGroup: (groupId: number, groupName: string) => void;
  onRemoveGroupAdmin: (groupId: number, groupName: string, userId: number, username: string) => void;
}) {
  const users = overview?.users ?? [];
  const groups = overview?.groups ?? [];

  return (
    <Stack spacing={3}>
      <AdminSectionTitle title="Management" subtitle="" />

      {loading ? <Typography sx={{ color: "text.secondary" }}>Loading admin data...</Typography> : null}

      <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.94)" }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
            Users
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Groups</TableCell>
                  <TableCell>Created groups</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{user.username}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={roleDrafts[user.id] ?? user.role}
                        onChange={(event) => onRoleChange(user.id, event.target.value)}
                        disabled={savingRoleUserId === user.id || user.username === currentUsername}
                        sx={{ minWidth: 140 }}
                      >
                        {ADMIN_ROLES.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>{user.membershipsCount}</TableCell>
                    <TableCell>{user.groupsCreatedCount}</TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => onUpdateUserRole(user.id, user.username, user.role)}
                          disabled={
                            savingRoleUserId === user.id ||
                            (roleDrafts[user.id] ?? user.role) === user.role ||
                            user.username === currentUsername
                          }
                        >
                          Save role
                        </Button>
                        <Button
                          color="error"
                          variant="outlined"
                          size="small"
                          startIcon={<DeleteOutlineRoundedIcon />}
                          onClick={() => onDeleteUser(user.id, user.username)}
                          disabled={user.username === currentUsername}
                        >
                          Delete user
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!users.length ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography sx={{ color: "text.secondary" }}>No users found.</Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.94)" }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
            Groups
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Group</TableCell>
                  <TableCell>Admin</TableCell>
                  <TableCell>Members</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.map((group) => {
                  const admins = Array.isArray(group.admins) ? group.admins : [];

                  return (
                    <TableRow key={group.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700 }}>{group.name}</Typography>
                        {group.description ? (
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                            {group.description}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", alignItems: "center" }}>
                          {admins.length > 0 ? (
                            admins.map((admin) => (
                              <Stack key={admin?.id ?? admin?.username ?? "unknown"} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                                <Chip label={admin?.username ?? "unknown"} size="small" />
                                <Button
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  sx={{ minWidth: "auto", px: 1 }}
                                  onClick={() => onRemoveGroupAdmin(group.id, group.name, admin?.id ?? 0, admin?.username ?? "unknown")}
                                  disabled={loading}
                                  title="Remove admin status"
                                >
                                  Remove
                                </Button>
                              </Stack>
                            ))
                          ) : (
                            <Typography sx={{ color: "text.secondary" }}>No admins</Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>{group.memberCount}</TableCell>
                      <TableCell>{formatDate(group.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Button
                          color="error"
                          variant="outlined"
                          size="small"
                          startIcon={<DeleteOutlineRoundedIcon />}
                          onClick={() => onDeleteGroup(group.id, group.name)}
                        >
                          Delete group
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!groups.length ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography sx={{ color: "text.secondary" }}>No groups found.</Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}

function SuspiciousTab({
  suspiciousUsers,
  loading,
  onDeleteUser,
  onClear,
  onRefresh,
}: {
  suspiciousUsers: AdminSuspiciousResponse | null;
  loading: boolean;
  onDeleteUser: (userId: number, username: string) => void;
  onClear: (userId: number, username: string) => void;
  onRefresh: () => void;
}) {
  const users = suspiciousUsers?.suspiciousUsers ?? [];
  const [viewLogsOpen, setViewLogsOpen] = useState(false);
  const [viewLogsForUserId, setViewLogsForUserId] = useState<number | null>(null);
  const [viewLogsForUsername, setViewLogsForUsername] = useState<string | null>(null);
  const [userLogs, setUserLogs] = useState<AdminLogEntry[] | null>(null);
  const [loadingUserLogs, setLoadingUserLogs] = useState(false);

  const openViewLogs = async (userId: number, username: string) => {
    setViewLogsForUserId(userId);
    setViewLogsForUsername(username);
    setViewLogsOpen(true);
    setLoadingUserLogs(true);

    try {
      const currentToken = getToken();
      const auth = currentToken ? { token: currentToken } : {};
      const response = await fetchFromBackend<AdminLogsResponse>(`/admin/logs?userId=${userId}&page=1&pageSize=50`, auth);
      setUserLogs(response.logs);
    } catch (error) {
      setUserLogs(null);
    } finally {
      setLoadingUserLogs(false);
    }
  };

  const closeViewLogs = () => {
    setViewLogsOpen(false);
    setViewLogsForUserId(null);
    setViewLogsForUsername(null);
    setUserLogs(null);
  };

  return (
    <Stack spacing={3}>
      <AdminSectionTitle title="Suspicious Users" subtitle="" />

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
        <Button variant="text" startIcon={<RefreshRoundedIcon />} onClick={onRefresh}>
          Refresh
        </Button>
        <Typography sx={{ color: "text.secondary", alignSelf: "center" }}>
          {loading ? "Loading..." : `${users.length} users flagged`}
        </Typography>
      </Stack>

      {users.length === 0 ? (
        <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.94)" }}>
          <CardContent>
            <Typography sx={{ color: "text.secondary" }}>No suspicious users yet.</Typography>
          </CardContent>
        </Card>
      ) : null}

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" } }}>
        {users.map((entry) => {
          const uniqueObservations = Array.from(
            new Map(
              entry.observations.map((obs) => [obs.ruleKey, obs])
            ).values()
          );

          return (
            <Card key={entry.userId} sx={{ borderRadius: 2, background: "rgba(255,255,255,0.95)", border: "1px solid rgba(143,73,194,0.14)" }}>
              <CardContent sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{entry.user.username}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
                    {entry.user.email}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                    Reason
                  </Typography>
                  <Typography sx={{ mt: 0.4, fontWeight: 600, fontSize: 14, overflowWrap: "anywhere" }}>
                    {entry.reason ?? "-"}
                  </Typography>
                </Box>

                {uniqueObservations && uniqueObservations.length > 0 && (
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      Observations ({uniqueObservations.length})
                    </Typography>
                    <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                      {uniqueObservations.map((obs, idx) => (
                        <Box key={idx} sx={{ p: 1, borderRadius: 0.75, bgcolor: "rgba(247,251,255,0.95)", border: "1px solid rgba(34,58,90,0.08)" }}>
                          <Typography sx={{ fontWeight: 500, fontSize: 13 }}>{obs.note}</Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                            {formatDate(obs.createdAt)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}

                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", pt: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => openViewLogs(entry.userId, entry.user.username)} disabled={loading}>
                    View logs
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => onClear(entry.userId, entry.user.username)} disabled={loading}>
                    Clear
                  </Button>
                  <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => onDeleteUser(entry.userId, entry.user.username)} disabled={loading}>
                    Delete user account
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Dialog open={viewLogsOpen} onClose={closeViewLogs} fullWidth maxWidth="md">
        <DialogTitle>Logs for {viewLogsForUsername ?? `#${viewLogsForUserId}`}</DialogTitle>
        <DialogContent dividers>
          {loadingUserLogs ? (
            <Typography>Loading logs...</Typography>
          ) : userLogs && userLogs.length ? (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Outcome</TableCell>
                    <TableCell>IP</TableCell>
                    <TableCell>Device</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userLogs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell sx={{ fontSize: 13 }}>{formatDate(log.createdAt)}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{formatActionTypeLabel(log.actionType)}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{log.outcome ? formatOutcomeLabel(log.outcome) : "-"}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{log.ip ?? "-"}</TableCell>
                      <TableCell sx={{ fontSize: 13, maxWidth: 200, overflowWrap: "anywhere" }}>{log.clientInfo ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : (
            <Typography sx={{ color: "text.secondary" }}>No logs available for this user.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeViewLogs}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "rgba(247,251,255,0.95)", border: "1px solid rgba(34,58,90,0.10)", minWidth: 130, flex: 1 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</Typography>
      <Typography sx={{ fontWeight: 900, fontSize: 22, lineHeight: 1.2, mt: 0.5 }}>
        {value}{unit ? <Typography component="span" sx={{ fontSize: 13, fontWeight: 400, color: "text.secondary", ml: 0.5 }}>{unit}</Typography> : null}
      </Typography>
    </Box>
  );
}

function ResultPanel({ result, title }: { result: AppStatsResult; title: string }) {
  const modeColor: Record<string, string> = {
    "no-cache": "#d32f2f",
    optimized: "#1976d2",
    cache: "#388e3c",
  };

  const modeLabel: Record<string, string> = {
    "no-cache": "No cache",
    optimized: "Optimized",
    cache: "Cache hit",
  };

  return (
    <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.94)", flex: 1, minWidth: 0 }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, flexGrow: 1 }}>{title}</Typography>
          <Chip
            label={modeLabel[result.mode] ?? result.mode}
            size="small"
            sx={{ bgcolor: modeColor[result.mode] ?? "#555", color: "#fff", fontWeight: 700 }}
          />
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5, mb: 2 }}>
          <StatCard label="Duration" value={result.durationMs} unit="ms" />
          <StatCard label="Expenses" value={result.totalExpenses.toLocaleString()} />
          <StatCard label="Participants" value={result.totalParticipants.toLocaleString()} />
          <StatCard label="Payments" value={result.totalPayments.toLocaleString()} />
          <StatCard label="Net debts" value={result.totalDebts.toLocaleString()} />
        </Stack>

        {result.debts.length > 0 && (
          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              First 10 debts
            </Typography>
            <Box sx={{ overflowX: "auto", mt: 0.75 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>From user ID</TableCell>
                    <TableCell>To user ID</TableCell>
                    <TableCell align="right">Amount (RON)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.debts.slice(0, 10).map((debt, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>{debt.fromUserId}</TableCell>
                      <TableCell>{debt.toUserId}</TableCell>
                      <TableCell align="right">{debt.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function PerformanceTab({ token }: { token: string | null }) {
  const [naiveResult, setNaiveResult] = useState<AppStatsResult | null>(null);
  const [optimizedResult, setOptimizedResult] = useState<AppStatsResult | null>(null);
  const [cachedResult, setCachedResult] = useState<AppStatsResult | null>(null);
  const [loadingNaive, setLoadingNaive] = useState(false);
  const [loadingOptimized, setLoadingOptimized] = useState(false);
  const [loadingCached, setLoadingCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = token ? { token } : {};

  const runNaive = async () => {
    setLoadingNaive(true);
    setError(null);
    try {
      const result = await fetchFromBackend<AppStatsResult>("/admin/app-stats?optimized=false", auth);
      setNaiveResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run naive query.");
    } finally {
      setLoadingNaive(false);
    }
  };

  const runOptimized = async () => {
    setLoadingOptimized(true);
    setError(null);
    try {
      const result = await fetchFromBackend<AppStatsResult>("/admin/app-stats?optimized=true", auth);
      setOptimizedResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run optimized query.");
    } finally {
      setLoadingOptimized(false);
    }
  };

  const runCached = async () => {
    setLoadingCached(true);
    setError(null);
    try {
      const result = await fetchFromBackend<AppStatsResult>("/admin/app-stats?optimized=true", auth);
      setCachedResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run cached query.");
    } finally {
      setLoadingCached(false);
    }
  };

  const speedup =
    naiveResult && optimizedResult && optimizedResult.durationMs > 0
      ? (naiveResult.durationMs / optimizedResult.durationMs).toFixed(1)
      : null;

  return (
    <Stack spacing={3}>
      <AdminSectionTitle
        title="Performance - app balances"
        subtitle=""
      />

      {error ? <Alert severity="error">{error}</Alert> : null}


      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Button
          variant="contained"
          color="error"
          onClick={() => { void runNaive(); }}
          disabled={loadingNaive}
          sx={{ fontWeight: 700, minWidth: 200 }}
        >
          {loadingNaive ? "Running…" : "Run naive query"}
        </Button>

        <Button
          variant="contained"
          color="primary"
          onClick={() => { void runOptimized(); }}
          disabled={loadingOptimized}
          sx={{ fontWeight: 700, minWidth: 200 }}
        >
          {loadingOptimized ? "Running…" : "Run optimized query"}
        </Button>

        <Button
          variant="outlined"
          color="success"
          onClick={() => { void runCached(); }}
          disabled={loadingCached || !optimizedResult}
          sx={{ fontWeight: 700, minWidth: 200 }}
          title="Run the optimized query again to demonstrate the cache hit"
        >
          {loadingCached ? "Running…" : "Run again (cache hit)"}
        </Button>
      </Stack>


      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ alignItems: "stretch" }}>
        {naiveResult ? <ResultPanel result={naiveResult} title="Result" /> : null}
        {optimizedResult ? <ResultPanel result={optimizedResult} title="Result" /> : null}
        {cachedResult ? <ResultPanel result={cachedResult} title="Result" /> : null}
      </Stack>

    </Stack>
  );
}

export function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [suspiciousUsers, setSuspiciousUsers] = useState<AdminSuspiciousResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingSuspicious, setLoadingSuspicious] = useState(true);
  const [token] = useState<string | null>(getToken);
  const [role, setRole] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>({});
  const [savingRoleUserId, setSavingRoleUserId] = useState<number | null>(null);
  const [currentUsername, setCurrentUsername] = useState(DEFAULT_USERNAME);
  const [activeTab, setActiveTab] = useState<AdminTab>("management");

  const isAdmin = role === "admin";

  const loadOverview = useCallback(async () => {
    try {
      const auth = token ? { token } : {};
      const response = await fetchFromBackend<AdminOverview>("/admin/overview", auth);
      setOverview(response);
      setRoleDrafts(Object.fromEntries(response.users.map((user) => [user.id, user.role])));
      setErrorMessage(null);
    } catch (error) {
      setOverview(null);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load admin data.");
    } finally {
      setLoadingOverview(false);
    }
  }, [token]);

  const loadSuspicious = useCallback(async () => {
    try {
      const auth = token ? { token } : {};
      const response = await fetchFromBackend<AdminSuspiciousResponse>("/admin/suspicious", auth);
      setSuspiciousUsers(response);
      setErrorMessage(null);
    } catch (error) {
      setSuspiciousUsers(null);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load suspicious users.");
    } finally {
      setLoadingSuspicious(false);
    }
  }, [token]);

  const loadAdminData = useCallback(async () => {
    setLoadingOverview(true);
    setLoadingSuspicious(true);
    await Promise.all([loadOverview(), loadSuspicious()]);
  }, [loadOverview, loadSuspicious]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRole(getRole());
      setCurrentUsername(getUsername());
      setAuthReady(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      const timeoutId = window.setTimeout(() => {
        void loadAdminData();
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [isAdmin, loadAdminData]);

  useEffect(() => {
    const handleBackendUpdate = () => {
      if (isAdmin) {
        void loadAdminData();
      }
    };

    window.addEventListener("splitmates:backend-update", handleBackendUpdate);
    return () => window.removeEventListener("splitmates:backend-update", handleBackendUpdate);
  }, [isAdmin, loadAdminData]);

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!window.confirm(`Delete the account for ${username}? This will remove their user data and created groups.`)) {
      return;
    }

    try {
      const auth = token ? { token } : {};
      await fetchFromBackend(`/admin/users/${userId}`, { method: "DELETE", ...auth });
      await loadAdminData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete user.");
    }
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    if (!window.confirm(`Delete the group ${groupName}?`)) {
      return;
    }

    try {
      const auth = token ? { token } : {};
      await fetchFromBackend(`/admin/groups/${groupId}`, { method: "DELETE", ...auth });
      await loadAdminData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete group.");
    }
  };

  const handleRemoveGroupAdmin = async (groupId: number, groupName: string, userId: number, username: string) => {
    if (!window.confirm(`Remove ${username} as admin from ${groupName}?`)) {
      return;
    }

    try {
      const auth = token ? { token } : {};
      await fetchFromBackend(`/admin/groups/${groupId}/admins/${userId}`, { method: "DELETE", ...auth });
      await loadAdminData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to remove group admin.");
    }
  };

  const handleRoleChange = (userId: number, nextRole: string) => {
    setRoleDrafts((current) => ({
      ...current,
      [userId]: nextRole,
    }));
  };

  const handleUpdateUserRole = async (userId: number, username: string, currentRole: string) => {
    const nextRole = roleDrafts[userId] ?? currentRole;
    if (nextRole === currentRole) {
      return;
    }

    if (!window.confirm(`Change ${username}'s role to ${nextRole}?`)) {
      return;
    }

    try {
      setSavingRoleUserId(userId);
      const auth = token ? { token } : {};
      await fetchFromBackend(`/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
        ...auth,
      });
      await loadAdminData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update user role.");
    } finally {
      setSavingRoleUserId(null);
    }
  };

  const handleClearSuspiciousUser = async (userId: number, username: string) => {
    if (!window.confirm(`Clear suspicious status for ${username}? They will no longer appear in the suspicious users list.`)) {
      return;
    }

    try {
      const auth = token ? { token } : {};
      await fetchFromBackend(`/admin/suspicious/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cleared" }),
        ...auth,
      });
      await loadSuspicious();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to clear suspicious status.");
    }
  };

  if (!authReady) {
    return (
      <Box sx={{ minHeight: "100vh", background: "linear-gradient(108deg, rgba(248,233,255,0.95) 0%, rgba(239,227,255,0.94) 50%, rgba(227,246,255,0.94) 100%)" }}>
        <AppNavbar />
        <Container maxWidth="lg" sx={{ py: 5 }}>
          <Typography sx={{ color: "text.secondary" }}>Loading admin access...</Typography>
        </Container>
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Box sx={{ minHeight: "100vh", background: "linear-gradient(108deg, rgba(248,233,255,0.95) 0%, rgba(239,227,255,0.94) 50%, rgba(227,246,255,0.94) 100%)" }}>
        <AppNavbar />
        <Container maxWidth="lg" sx={{ py: 5 }}>
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            You do not have access to the admin area.
          </Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(108deg, rgba(248,233,255,0.95) 0%, rgba(239,227,255,0.94) 50%, rgba(227,246,255,0.94) 100%)" }}>
      <AppNavbar />
      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: { xs: 38, md: 56 }, fontWeight: 900, lineHeight: 1 }}>
              Admin
            </Typography>
            <Typography sx={{ color: "text.secondary", mt: 1 }}>
            </Typography>
          </Box>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.88)" }}>
            <CardContent sx={{ pb: 2 }}>
              <Tabs value={activeTab} onChange={(_, value: AdminTab) => setActiveTab(value)} variant="scrollable" allowScrollButtonsMobile>
                <Tab value="management" label="Management" />
                <Tab value="suspicious" label="Suspicious Users" />
                <Tab value="performance" label="Performance" />
              </Tabs>
            </CardContent>
          </Card>

          {activeTab === "management" ? (
            <ManagementTab
              overview={overview}
              loading={loadingOverview}
              currentUsername={currentUsername}
              roleDrafts={roleDrafts}
              savingRoleUserId={savingRoleUserId}
              onRoleChange={handleRoleChange}
              onUpdateUserRole={(userId, username, currentRole) => {
                void handleUpdateUserRole(userId, username, currentRole);
              }}
              onDeleteUser={(userId, username) => {
                void handleDeleteUser(userId, username);
              }}
              onDeleteGroup={(groupId, groupName) => {
                void handleDeleteGroup(groupId, groupName);
              }}
              onRemoveGroupAdmin={(groupId, groupName, userId, username) => {
                void handleRemoveGroupAdmin(groupId, groupName, userId, username);
              }}
            />
          ) : null}

          {activeTab === "suspicious" ? (
            <SuspiciousTab
              suspiciousUsers={suspiciousUsers}
              loading={loadingSuspicious}
              onDeleteUser={(userId, username) => {
                void handleDeleteUser(userId, username);
              }}
              onClear={(userId, username) => {
                void handleClearSuspiciousUser(userId, username);
              }}
              onRefresh={() => {
                void loadSuspicious();
              }}
            />
          ) : null}

          {activeTab === "performance" ? (
            <PerformanceTab token={token} />
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
