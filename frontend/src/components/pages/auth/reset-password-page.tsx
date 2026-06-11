"use client";

import { useRouter, useSearchParams } from "next/navigation";
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

export function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    try {
      await fetchFromBackend<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      router.push("/login");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}>
        <Typography sx={{ color: "white", fontWeight: 700 }}>
          Invalid reset link.{" "}
          <Link href="/forgot-password" style={{ color: "#7f76d5" }}>Request a new one.</Link>
        </Typography>
      </Box>
    );
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
            Reset password
          </Typography>

          <Typography sx={{ mt: 1.2, color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            Enter your new password below.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2.2, display: "grid", gap: 1.2, position: "relative", zIndex: 1 }}>
              <Typography sx={{ ...labelSx, mt: 1.2 }}>New password</Typography>
              <TextField name="password" type="password" fullWidth size="small" sx={fieldSx} />

              <Typography sx={{ ...labelSx, mt: 0.8 }}>Confirm new password</Typography>
              <TextField name="confirmPassword" type="password" fullWidth size="small" sx={fieldSx} />

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
                {loading ? "Resetting..." : "Reset password"}
              </Button>
            </Box>

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