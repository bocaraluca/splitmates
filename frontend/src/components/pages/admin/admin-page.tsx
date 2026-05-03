"use client";

import { useCallback, useEffect, useState } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Alert, Box, Button, Card, CardContent, Chip, Container, Divider, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AppNavbar } from "@/components/navigation/app-navbar";
import { fetchFromBackend } from "@/lib/backend-api";
import { DEFAULT_USERNAME, getRole, getToken, getUsername } from "@/lib/auth-storage";
import type { AdminOverview } from "@/lib/types";

const ADMIN_ROLES = ["admin", "user"] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [token] = useState<string | null>(getToken);
  const [role, setRole] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>({});
  const [savingRoleUserId, setSavingRoleUserId] = useState<number | null>(null);
  const [currentUsername, setCurrentUsername] = useState(DEFAULT_USERNAME);

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
      setLoading(false);
    }
  }, [token]);

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
        void loadOverview();
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [isAdmin, loadOverview]);

  useEffect(() => {
    const handleBackendUpdate = () => {
      if (isAdmin) {
        void loadOverview();
      }
    };

    window.addEventListener("splitmates:backend-update", handleBackendUpdate);
    return () => window.removeEventListener("splitmates:backend-update", handleBackendUpdate);
  }, [isAdmin, loadOverview]);

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!window.confirm(`Delete the account for ${username}? This will remove their user data and created groups.`)) {
      return;
    }

    try {
      const auth = token ? { token } : {};
      await fetchFromBackend(`/admin/users/${userId}`, { method: "DELETE", ...auth });
      await loadOverview();
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
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete group.");
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
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update user role.");
    } finally {
      setSavingRoleUserId(null);
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
          </Box>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

          {loading ? <Typography sx={{ color: "text.secondary" }}>Loading admin data...</Typography> : null}

          <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.94)" }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
                Users
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Table size="small">
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
                  {overview?.users.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700 }}>{user.username}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {user.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={1} sx={{ minWidth: 160 }}>
                          <TextField
                            select
                            size="small"
                            value={roleDrafts[user.id] ?? user.role}
                            onChange={(event) => handleRoleChange(user.id, event.target.value)}
                            disabled={savingRoleUserId === user.id || user.username === currentUsername}
                          >
                            {ADMIN_ROLES.map((option) => (
                              <MenuItem key={option} value={option}>
                                {option}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Stack>
                      </TableCell>
                      <TableCell>{user.membershipsCount}</TableCell>
                      <TableCell>{user.groupsCreatedCount}</TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => void handleUpdateUserRole(user.id, user.username, user.role)}
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
                            onClick={() => void handleDeleteUser(user.id, user.username)}
                            disabled={user.username === currentUsername}
                          >
                            Delete user
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!overview?.users.length ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography sx={{ color: "text.secondary" }}>No users found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.94)" }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
                Groups
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Table size="small">
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
                  {overview?.groups.map((group) => {
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
                          <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
                            {admins.length > 0 ? (
                              admins.map((admin) => (
                                <Chip key={admin?.id ?? admin?.username ?? "unknown"} label={admin?.username ?? "unknown"} size="small" />
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
                            onClick={() => void handleDeleteGroup(group.id, group.name)}
                          >
                            Delete group
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!overview?.groups.length ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography sx={{ color: "text.secondary" }}>No groups found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}