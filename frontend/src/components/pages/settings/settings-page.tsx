"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box, Button, Card, CardContent, Container,
  Divider, Stack, TextField, Typography, Chip, Alert,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { AppNavbar } from "@/components/navigation/app-navbar";
import { fetchFromBackend } from "@/lib/backend-api";
import { getRole, getToken, updateUsername } from "@/lib/auth-storage";

interface ProfileData {
  id: number;
  username: string;
  email: string;
  stripeAccountId: string | null;
  createdAt: string;
}

export function SettingsPage() {
  const router = useRouter();
  const [token] = useState<string | null>(getToken);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = getRole() === "admin";

  const [username, setUsername] = useState("");
  const [usernameMsg, setUsernameMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [usernameBusy, setUsernameBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [stripeMsg, setStripeMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [stripeBusy, setStripeBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    fetchFromBackend<{ user: ProfileData }>("/profile", { token })
      .then((res) => {
        setProfile(res.user);
        setUsername(res.user.username);
        setEmail(res.user.email);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("503") || msg.includes("502") || msg.includes("Service")) return;
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [token, router]);

  async function handleUpdateUsername() {
    if (!token) return;
    setUsernameBusy(true);
    setUsernameMsg(null);
    try {
      const res = await fetchFromBackend<{ user: ProfileData }>("/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({ username }),
      });
      setProfile(res.user);
      setUsername(res.user.username);
      updateUsername(res.user.username);
      setUsernameMsg({ text: "Username updated.", error: false });
    } catch (error) {
      setUsernameMsg({ text: error instanceof Error ? error.message : "Failed to update username.", error: true });
    } finally {
      setUsernameBusy(false);
    }
  }

  async function handleUpdateEmail() {
    if (!token) return;
    setEmailBusy(true);
    setEmailMsg(null);
    try {
      const res = await fetchFromBackend<{ user: ProfileData }>("/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({ email }),
      });
      setProfile(res.user);
      setEmail(res.user.email);
      setEmailMsg({ text: "Email updated.", error: false });
    } catch (error) {
      setEmailMsg({ text: error instanceof Error ? error.message : "Failed to update email.", error: true });
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleChangePassword() {
    if (!token) return;
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "New passwords do not match.", error: true });
      return;
    }
    setPasswordBusy(true);
    setPasswordMsg(null);
    try {
      await fetchFromBackend("/profile/password", {
        method: "PATCH",
        token,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ text: "Password changed successfully.", error: false });
    } catch (error) {
      setPasswordMsg({ text: error instanceof Error ? error.message : "Failed to change password.", error: true });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleConnectStripe() {
    if (!token) return;
    setStripeBusy(true);
    setStripeMsg(null);
    try {
      const res = await fetchFromBackend<{ stripeAccountId: string }>("/profile/stripe", { method: "POST", token });
      if (res?.stripeAccountId) {
        setProfile((prev) => prev ? { ...prev, stripeAccountId: res.stripeAccountId } : prev);
        setStripeMsg({ text: "Stripe account connected.", error: false });
      } else {
        setStripeMsg({ text: "Failed to connect Stripe. Try again.", error: true });
      }
    } catch (error) {
      setStripeMsg({ text: error instanceof Error ? error.message : "Failed to connect Stripe.", error: true });
    } finally {
      setStripeBusy(false);
    }
  }

  async function handleUnlinkStripe() {
    if (!token) return;
    setStripeBusy(true);
    setStripeMsg(null);
    try {
      await fetchFromBackend("/profile/stripe", { method: "DELETE", token });
      setProfile((prev) => prev ? { ...prev, stripeAccountId: null } : prev);
      setStripeMsg({ text: "Stripe account unlinked.", error: false });
    } catch (error) {
      setStripeMsg({ text: error instanceof Error ? error.message : "Failed to unlink.", error: true });
    } finally {
      setStripeBusy(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", background: "transparent" }}>
        <AppNavbar />
        <Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
          <Typography>Loading...</Typography>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "transparent" }}>
      <AppNavbar />
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={3}>
          <Typography variant="h3" sx={{ fontWeight: 900 }}>Settings</Typography>

          <Card sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Username</Typography>
              <Stack spacing={1.5}>
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  fullWidth
                  size="small"
                  helperText="Lowercase letters, numbers and underscores only."
                />
                {usernameMsg && (
                  <Alert severity={usernameMsg.error ? "error" : "success"}>{usernameMsg.text}</Alert>
                )}
                <Button
                  variant="contained"
                  onClick={() => void handleUpdateUsername()}
                  disabled={usernameBusy || username === profile?.username || username.trim().length < 2}
                  sx={{ alignSelf: "flex-start", bgcolor: "#6f29c6", fontWeight: 800, textTransform: "none", borderRadius: 999 }}
                >
                  {usernameBusy ? "Saving..." : "Save username"}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Divider />

          <Card sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Email</Typography>
              <Stack spacing={1.5}>
                <TextField
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  size="small"
                />
                {emailMsg && (
                  <Alert severity={emailMsg.error ? "error" : "success"}>{emailMsg.text}</Alert>
                )}
                <Button
                  variant="contained"
                  onClick={() => void handleUpdateEmail()}
                  disabled={emailBusy || email === profile?.email || !email.includes("@")}
                  sx={{ alignSelf: "flex-start", bgcolor: "#6f29c6", fontWeight: 800, textTransform: "none", borderRadius: 999 }}
                >
                  {emailBusy ? "Saving..." : "Save email"}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Divider />

          <Card sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Change Password</Typography>
              <Stack spacing={1.5}>
                <TextField
                  label="Current password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  fullWidth
                  size="small"
                  helperText="Minimum 6 characters."
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  fullWidth
                  size="small"
                />
                {passwordMsg && (
                  <Alert severity={passwordMsg.error ? "error" : "success"}>{passwordMsg.text}</Alert>
                )}
                <Button
                  variant="contained"
                  onClick={() => void handleChangePassword()}
                  disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
                  sx={{ alignSelf: "flex-start", bgcolor: "#6f29c6", fontWeight: 800, textTransform: "none", borderRadius: 999 }}
                >
                  {passwordBusy ? "Saving..." : "Change password"}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Divider />

          {!isAdmin && <Card sx={{ borderRadius: 2, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Stripe Account</Typography>
                {profile?.stripeAccountId ? (
                  <Chip label="Connected" size="small" sx={{ bgcolor: "rgba(39,174,96,0.12)", color: "#27ae60", fontWeight: 700 }} />
                ) : (
                  <Chip label="Not connected" size="small" sx={{ bgcolor: "rgba(200,200,200,0.2)", fontWeight: 700 }} />
                )}
              </Stack>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                Connect your Stripe account to send and receive payments directly from SplitMates.
              </Typography>
              <Stack spacing={1.5}>
                {stripeMsg && (
                  <Alert severity={stripeMsg.error ? "error" : "success"}>{stripeMsg.text}</Alert>
                )}
                {profile?.stripeAccountId && (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Your Stripe account: <Box component="span" sx={{ fontFamily: "monospace" }}>{profile.stripeAccountId}</Box>
                  </Typography>
                )}
                <Stack direction="row" spacing={1}>
                  {!profile?.stripeAccountId && (
                    <Button
                      variant="contained"
                      onClick={() => void handleConnectStripe()}
                      disabled={stripeBusy}
                      sx={{ bgcolor: "#635bff", fontWeight: 800, textTransform: "none", borderRadius: 999, "&:hover": { bgcolor: "#4f49cc" } }}
                    >
                      {stripeBusy ? "Connecting..." : "Connect Stripe"}
                    </Button>
                  )}
                  {profile?.stripeAccountId && (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => void handleUnlinkStripe()}
                      disabled={stripeBusy}
                      sx={{ fontWeight: 800, textTransform: "none", borderRadius: 999 }}
                    >
                      {stripeBusy ? "Unlinking..." : "Unlink"}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>}
        </Stack>
      </Container>
    </Box>
  );
}
