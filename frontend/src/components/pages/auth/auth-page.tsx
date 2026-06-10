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
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.07)",
    color: "white",
    "& fieldset": { borderColor: "rgba(255,255,255,0.15)" },
    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" },
    "&.Mui-focused fieldset": { borderColor: "#e83ea8" },
    "& input::placeholder": { color: "rgba(255,255,255,0.3)", opacity: 1 },
  },
  "& .MuiInputBase-input": { color: "white" },
} as const;

const labelSx = { fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.75)" } as const;

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

      login(response.user.username, response.token, response.role, response.permissions);
      router.push(response.role === "admin" ? "/admin" : "/dashboard");
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
            background: "rgba(10,5,30,0.72)",
            borderRadius: 3,
            px: { xs: 3, md: 5.5 },
            py: { xs: 4, md: 5 },
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <Typography
            sx={{
              textAlign: "left",
              fontSize: { xs: 52, md: 62 },
              fontWeight: 900,
              lineHeight: 0.92,
              color: "white",
            }}
          >
            {copy.title}
          </Typography>

          <Typography sx={{ mt: 1.2, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
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
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Link href="/forgot-password" style={{ color: "#a78bfa", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </Box>
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
                background: "linear-gradient(90deg, #e83ea8, #8b5cf6)",
                boxShadow: "0 8px 24px rgba(232,62,168,0.4)",
                width: "100%",
                maxWidth: 260,
                justifySelf: "center",
                "&:hover": { boxShadow: "0 8px 24px rgba(232,62,168,0.5)", opacity: 0.92 },
              }}
            >
              {copy.action}
            </Button>
          </Box>

          <Box sx={{ mt: 2, display: "grid", gap: 1.2 }}>
            <Typography sx={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>or</Typography>
            <Button
              component={Link}
              href="/magic-link"
              variant="contained"
              sx={{
                py: 0.85,
                borderRadius: 1.5,
                fontSize: { xs: 15, md: 17 },
                fontWeight: 800,
                textTransform: "none",
                background: "#7f76d5",
                boxShadow: "0 8px 20px rgba(127, 118, 213, 0.3)",
                width: "100%",
                maxWidth: 360,
                justifySelf: "center",
                "&:hover": { background: "#6e65c4" },
              }}
            >
              ✉ {mode === "login" ? "Log in" : "Sign up"} using email link
            </Button>
            <Button
              component="a"
              href="/api/auth/google"
              variant="contained"
              sx={{
                py: 0.85,
                borderRadius: 1.5,
                fontSize: { xs: 15, md: 17 },
                fontWeight: 800,
                textTransform: "none",
                background: "#4285f4",
                boxShadow: "0 8px 20px rgba(66, 133, 244, 0.3)",
                width: "100%",
                maxWidth: 360,
                justifySelf: "center",
                "&:hover": { background: "#3574e2" },
              }}
            >
              <Box component="span" sx={{ mr: 1, fontFamily: "Arial, sans-serif", fontWeight: 700, fontSize: 18, color: "white", lineHeight: 1 }}>G</Box>
              {mode === "login" ? "Log in" : "Sign up"} with Google
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mt: 2.2, color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center" }}>
            {copy.bottomText}{" "}
            <Link href={copy.bottomHref} style={{ color: "#e83ea8", fontWeight: 700, textDecoration: "none" }}>
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
