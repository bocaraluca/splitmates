"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MenuIcon from "@mui/icons-material/MenuRounded";
import { AppBar, Box, Button, Container, IconButton, Menu, MenuItem, Stack, Toolbar, Typography } from "@mui/material";
import { fetchFromBackend } from "@/lib/backend-api";
import { DEFAULT_USERNAME, getRole, getToken, getUsername, logout } from "@/lib/auth-storage";
import { NotificationBell } from "./notification-bell";

export function AppNavbar() {
  const router = useRouter();
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);
  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setUsername(getUsername());
      setRole(getRole());
    }, 0);

    const handleUsernameChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ username: string }>).detail;
      setUsername(detail.username);
    };

    window.addEventListener("splitmates:username-changed", handleUsernameChanged);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("splitmates:username-changed", handleUsernameChanged);
    };
  }, []);

  const userMenuOpen = Boolean(userMenuAnchor);
  const mobileMenuOpen = Boolean(mobileMenuAnchor);
  const avatarInitial = useMemo(() => (username?.trim()?.[0] ?? "U").toUpperCase(), [username]);

  function handleOpenUserMenu(event: React.MouseEvent<HTMLElement>) {
    setUserMenuAnchor(event.currentTarget);
  }

  function handleCloseUserMenu() {
    setUserMenuAnchor(null);
  }

  function handleOpenMobileMenu(event: React.MouseEvent<HTMLElement>) {
    setMobileMenuAnchor(event.currentTarget);
  }

  function handleCloseMobileMenu() {
    setMobileMenuAnchor(null);
  }

  async function handleLogout() {
    const currentToken = getToken();
    try {
      await fetchFromBackend("/auth/logout", { method: "POST", token: currentToken ?? undefined });
    } catch {
    }

    logout();
    setUsername(DEFAULT_USERNAME);
    setRole(null);
    setUserMenuAnchor(null);
    setMobileMenuAnchor(null);
    router.push("/");
  }

  return (
    <AppBar
      position="sticky"
      sx={{
        top: 0,
        background: "linear-gradient(90deg, #5b36c8 0%, #d841aa 54%, #52c7ea 100%)",
        borderTop: 0,
        borderBottom: "1px solid rgba(255,255,255,0.22)",
      }}
    >
      <Container maxWidth={false} sx={{ px: { xs: 2, md: 3 } }}>
        <Toolbar disableGutters sx={{ minHeight: { xs: 72, md: 86 }, gap: 2, position: "relative" }}>
          <Box
            sx={{
              minWidth: 0,
              px: 0,
              display: "flex",
              alignItems: "center",
              gap: 1.4,
              zIndex: 2,
            }}
          >
            <Box
              sx={{
                width: 58,
                height: 58,
                overflow: "hidden",
                flex: "0 0 auto",
              }}
            >
              <Image src="/assets/logo.png" alt="SplitMates logo" width={58} height={58} priority />
            </Box>
              {username && username !== DEFAULT_USERNAME ? (
                <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5 }}>
                  <Typography sx={{ fontWeight: 900, fontSize: { xs: 18, md: 22 }, lineHeight: 1, letterSpacing: "-0.02em" }}>
                    <Box component="span" sx={{ color: "#f38ea4" }}>
                      Split
                    </Box>
                    <Box component="span" sx={{ color: "#73c3e8" }}>
                      Mates
                    </Box>
                  </Typography>
                </Box>
              ) : null}
          </Box>

          <IconButton
            aria-label="Open navigation menu"
            onClick={handleOpenMobileMenu}
            sx={{
              display: { xs: "inline-flex", md: "none" },
              ml: "auto",
              color: "white",
              bgcolor: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.24)",
              width: 44,
              height: 44,
              flex: "0 0 auto",
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.18)",
              },
            }}
          >
            <MenuIcon />
          </IconButton>

          <Stack
            direction="row"
            spacing={2.2}
            sx={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              display: { xs: "none", md: "flex" },
              zIndex: 1,
            }}
          >
            {role !== "admin" && (
              <>
                <Button component={Link} href="/dashboard" sx={{ color: "#eef3ff", fontWeight: 800, fontSize: 17 }}>
                  Dashboard
                </Button>
                <Button component={Link} href="/groups" sx={{ color: "#eef3ff", fontWeight: 800, fontSize: 17 }}>
                  Groups
                </Button>
                <Button component={Link} href="/insights/bad-habits" sx={{ color: "#eef3ff", fontWeight: 800, fontSize: 17 }}>
                  Insights
                </Button>
              </>
            )}
          </Stack>

          <Stack direction="row" spacing={1.2} sx={{ ml: "auto", alignItems: "center", zIndex: 2 }}>
            {role === "admin" ? (
              <Button component={Link} href="/admin" variant="outlined" sx={{ color: "white", borderColor: "rgba(255,255,255,0.5)", fontWeight: 800 }}>
                Admin
              </Button>
            ) : null}
            <NotificationBell />
            <Box
              onClick={handleOpenUserMenu}
              sx={{
                width: 46,
                height: 46,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                background: "#e9efff",
                color: "#7448b0",
                fontSize: 30,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {avatarInitial}
            </Box>
          </Stack>
          <Menu anchorEl={mobileMenuAnchor} open={mobileMenuOpen} onClose={handleCloseMobileMenu}>
            {role !== "admin" && (
              <>
                <MenuItem component={Link} href="/dashboard" onClick={handleCloseMobileMenu}>
                  Dashboard
                </MenuItem>
                <MenuItem component={Link} href="/groups" onClick={handleCloseMobileMenu}>
                  Groups
                </MenuItem>
                <MenuItem component={Link} href="/insights/bad-habits" onClick={handleCloseMobileMenu}>
                  Insights
                </MenuItem>
              </>
            )}
            {role === "admin" && (
              <MenuItem component={Link} href="/admin" onClick={handleCloseMobileMenu}>
                Admin
              </MenuItem>
            )}
          </Menu>
          <Menu anchorEl={userMenuAnchor} open={userMenuOpen} onClose={handleCloseUserMenu}
            slotProps={{ paper: { sx: { bgcolor: "rgba(30,10,53,0.65)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" } } }}
          >
            <Box sx={{ px: 2, py: 1.2 }}>
              <Typography variant="caption" sx={{ color: "text.secondary", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Logged in as
              </Typography>
              <Typography sx={{ fontWeight: 800 }}>{username}</Typography>
            </Box>
            <MenuItem component={Link} href="/settings" onClick={handleCloseUserMenu}>
              Settings
            </MenuItem>
            <MenuItem onClick={handleLogout}>Log out</MenuItem>
          </Menu>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
