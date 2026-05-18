"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, CircularProgress, Typography } from "@mui/material";
import { login } from "@/lib/auth-storage";
import { Suspense } from "react";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const username = searchParams.get("username");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError("Google sign-in failed. Please try again.");
      setTimeout(() => router.push("/login"), 3000);
      return;
    }

    if (!token || !username) {
      setError("Invalid callback. Please try again.");
      setTimeout(() => router.push("/login"), 3000);
      return;
    }

    const role = searchParams.get("role") ?? undefined;
    const permissionsRaw = searchParams.get("permissions");
    const permissions = permissionsRaw ? JSON.parse(decodeURIComponent(permissionsRaw)) as string[] : [];

    login(username, token, role, permissions);
    router.push("/dashboard");
  }, [searchParams, router]);

  if (error) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7ff" }}>
        <Typography sx={{ color: "#2f3137", fontWeight: 700 }}>{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f5f7ff", gap: 2 }}>
      <CircularProgress sx={{ color: "#8ca3ff" }} />
      <Typography sx={{ color: "#677089", fontSize: 14 }}>Signing you in with Google...</Typography>
    </Box>
  );
}

export default function Page() {
  return (
    <Suspense>
      <GoogleCallbackContent />
    </Suspense>
  );
}