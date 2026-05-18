"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";
import { fetchFromBackend } from "@/lib/backend-api";

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
          fontSize: { xs: 17, md: 19 },
          lineHeight: 1.15,
          minWidth: "auto",
          px: 1.6,
          py: 1,
          textTransform: "none",
          backgroundColor: "rgba(255, 255, 255, 0.16)",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.24)",
          },
        }}
      >
        ← Back to Login
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
              fontSize: { xs: 40, md: 50 },
              fontWeight: 900,
              lineHeight: 0.92,
              color: "#2f3137",
            }}
          >
            Magic link
          </Typography>

          <Typography sx={{ mt: 1.2, color: "#6f727a", fontSize: 14 }}>
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
                  background: "#e992a2",
                  boxShadow: "0 8px 20px rgba(209, 133, 153, 0.35)",
                  width: "100%",
                  maxWidth: 260,
                  justifySelf: "center",
                  "&:hover": { boxShadow: "0 8px 20px rgba(209, 133, 153, 0.35)", background: "#de8697" },
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
              <Typography sx={{ color: "#3a7d44", fontWeight: 700, fontSize: 14 }}>
                Check your inbox! A login link has been sent to your email.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1.5, color: "#6f727a", fontSize: 13 }}>
                The link expires in 1 hour. You can close this page.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}