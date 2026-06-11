"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";
import { fetchFromBackend } from "@/lib/backend-api";

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

export function MagicLinkPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;

    try {
      await fetchFromBackend<{ message: string }>("/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
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
        href="/login"
        sx={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 3,
          color: "white",
          fontWeight: 900,
          fontSize: 22,
          minWidth: 0,
          px: 2.2,
          py: 0.7,
          backgroundColor: "rgba(255,255,255,0.16)",
          border: "1px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(10px)",
          borderRadius: 999,
          "&:hover": { backgroundColor: "rgba(255,255,255,0.24)" },
        }}
      >
        ←
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
              fontSize: { xs: 40, md: 50 },
              fontWeight: 900,
              lineHeight: 0.92,
              color: "white",
            }}
          >
            Magic link
          </Typography>

          <Typography sx={{ mt: 1.2, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Enter your email and we'll send you a link to log in instantly.
          </Typography>

          {!sent ? (
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2.2, display: "grid", gap: 1.2 }}>
              <Typography sx={{ ...labelSx, mt: 1.2 }}>Email</Typography>
              <TextField name="email" type="email" placeholder="email" fullWidth size="small" sx={fieldSx} />

              <Button
                type="submit"
                disabled={loading}
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
                {loading ? "Sending..." : "Send link"}
              </Button>

              {errorMessage && (
                <Typography variant="body2" sx={{ mt: 1, color: "primary.main", fontWeight: 700, fontSize: 12, textAlign: "center" }}>
                  {errorMessage}
                </Typography>
              )}
            </Box>
          ) : (
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ color: "#34d399", fontWeight: 700, fontSize: 14 }}>
                Check your inbox! A login link has been sent to your email.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1.5, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                The link expires in 1 hour. You can close this page.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}