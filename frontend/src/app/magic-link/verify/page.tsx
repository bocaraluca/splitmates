"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, CircularProgress, Typography } from "@mui/material";
import { fetchFromBackend } from "@/lib/backend-api";
import { login } from "@/lib/auth-storage";
import type { LoginResponse } from "@/lib/types";
import { Suspense } from "react";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid magic link.");
      return;
    }

    fetchFromBackend<LoginResponse>("/auth/magic-link/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((response) => {
        login(response.user.username, response.token, response.role, response.permissions);
        router.push("/dashboard");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Invalid or expired link.");
      });
  }, [token, router]);

  if (error) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7ff" }}>
        <Typography sx={{ color: "#2f3137", fontWeight: 700 }}>
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f5f7ff", gap: 2 }}>
      <CircularProgress sx={{ color: "#8ca3ff" }} />
      <Typography sx={{ color: "#677089", fontSize: 14 }}>Logging you in...</Typography>
    </Box>
  );
}

export default function Page() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}