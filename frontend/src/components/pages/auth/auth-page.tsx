"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";
import { fetchFromBackend } from "@/lib/backend-api";
import { login } from "@/lib/auth-storage";
import { parseAuthLoginForm, parseAuthRegisterForm } from "@/lib/validators";
import type { LoginResponse } from "@/lib/types";

const authCopy = {
  login: {
    title: "Log in",
    subtitle: "Welcome back to SplitMates!",
    action: "Log in",
    bottomText: "Don’t have an account?",
    bottomLink: "Sign up",
    bottomHref: "/signup",
  },
  signup: {
    title: "Sign up",
    subtitle: "Create your SplitMates account",
    action: "Sign up",
    bottomText: "Already have an account?",
    bottomLink: "Log in",
    bottomHref: "/login",
  },
} as const;

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 1,
    backgroundColor: "#d5deea",
    "& fieldset": { borderColor: "#ccd4e0" },
    "&:hover fieldset": { borderColor: "#b9c2d0" },
    "&.Mui-focused fieldset": { borderColor: "#aeb8c8" },
  },
} as const;

const labelSx = { fontSize: 16, fontWeight: 800, color: "#2f3137" } as const;

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const copy = authCopy[mode];
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const payload = mode === "login" ? parseAuthLoginForm(formData) : parseAuthRegisterForm(formData);
      const response = await fetchFromBackend<LoginResponse>(mode === "login" ? "/auth/login" : "/auth/signup", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      login(response.user.username, response.token);
      router.push("/dashboard");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        backgroundImage: "url('/assets/auth-image.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "1fr" },
        gridTemplateRows: "1fr",
      }}
    >
      <Button
        component={Link}
        href="/"
        sx={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 3,
          color: "white",
          fontWeight: 700,
          fontSize: { xs: 13, md: 14 },
          minWidth: "auto",
          px: 0.6,
        }}
      >
        ← Back to Home Page
      </Button>

      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          display: { xs: "block", md: "none" },
          backdropFilter: "blur(9px)",
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      />

      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(380px, 440px) minmax(0, 0.38fr)" },
          alignItems: "center",
          minHeight: "100vh",
          px: { xs: 2.5, md: 4, lg: 6 },
        }}
      >
        <Box
          sx={{
            gridColumn: { lg: 2 },
            justifySelf: { xs: "center", lg: "stretch" },
            width: "100%",
            maxWidth: 520,
            background: "rgba(239, 239, 239, 0.72)",
            borderRadius: 2,
            px: { xs: 3, md: 5.5 },
            py: { xs: 4, md: 5 },
            boxShadow: "0 8px 26px rgba(28, 28, 52, 0.10)",
            backdropFilter: "blur(18px)",
            border: "1px solid rgba(255,255,255,0.58)",
          }}
        >
          <Typography
            sx={{
              textAlign: "left",
              fontSize: { xs: 52, md: 62 },
              fontWeight: 900,
              lineHeight: 0.92,
              color: "#2f3137",
            }}
          >
            {copy.title}
          </Typography>

          <Typography sx={{ mt: 1.2, color: "#6f727a", fontSize: 14 }}>
            {copy.subtitle}
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2.2, display: "grid", gap: 1.2, position: "relative", zIndex: 1 }}>
            {mode === "signup" ? (
              <>
                <Typography sx={{ ...labelSx, mt: 1.2 }}>Username</Typography>
                <TextField name="username" placeholder="username" fullWidth size="small" sx={fieldSx} />

                <Typography sx={{ ...labelSx, mt: 0.8 }}>Email</Typography>
                <TextField name="email" type="email" placeholder="email" fullWidth size="small" sx={fieldSx} />
              </>
            ) : (
              <>
                <Typography sx={{ ...labelSx, mt: 1.2 }}>Username / Email</Typography>
                <TextField name="identifier" placeholder="username or email" fullWidth size="small" sx={fieldSx} />
              </>
            )}

            <Typography sx={{ ...labelSx, mt: 0.8 }}>Password</Typography>
            <TextField name="password" type="password" placeholder="password" fullWidth size="small" sx={fieldSx} />

            {mode === "signup" ? (
              <>
                <Typography sx={{ ...labelSx, mt: 0.8 }}>Confirm password</Typography>
                <TextField name="confirmPassword" type="password" placeholder="confirm password" fullWidth size="small" sx={fieldSx} />
              </>
            ) : (
              <Box sx={{ height: 8 }} />
            )}

            <Button
              type="submit"
              variant="contained"
              sx={{
                mt: 2,
                py: 0.85,
                borderRadius: 1.5,
                fontSize: { xs: 18, md: 22 },
                fontWeight: 800,
                textTransform: "none",
                background: "#e992a2",
                boxShadow: "0 8px 20px rgba(209, 133, 153, 0.35)",
                width: "100%",
                maxWidth: 260,
                justifySelf: "center",
                "&:hover": { boxShadow: "0 8px 20px rgba(209, 133, 153, 0.35)", background: "#de8697" },
              }}
            >
              {copy.action}
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mt: 2.2, color: "#6f727a", fontSize: 14, textAlign: "center" }}>
            {copy.bottomText}{" "}
            <Link href={copy.bottomHref} style={{ color: "#7f76d5", fontWeight: 700, textDecoration: "none" }}>
              {copy.bottomLink}
            </Link>
          </Typography>
          {errorMessage && (
            <Typography variant="body2" sx={{ mt: 1.3, color: "primary.main", fontWeight: 700, fontSize: 12, textAlign: "center" }}>
              {errorMessage}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
