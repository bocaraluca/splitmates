"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Chip, Container, Stack, Typography } from "@mui/material";
import { AppNavbar } from "@/components/navigation/app-navbar";
import { fetchFromBackend } from "@/lib/backend-api";
import { getToken } from "@/lib/auth-storage";
import type { DashboardSummary, GroupSummary, UserBalance } from "@/lib/types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "RON", maximumFractionDigits: 2 }).format(value);
}

function BalanceList({ title, entries, amountColor, emptyText, keyPrefix }: {
  title: string;
  entries: UserBalance[];
  amountColor: string;
  emptyText: string;
  keyPrefix: string;
}) {
  return (
    <Card sx={{ borderRadius: 1, background: "rgba(255,255,255,0.9)", border: "1px solid rgba(31,53,86,0.08)" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.4 }}>
          {title}
        </Typography>
        <Stack spacing={0.9}>
          {entries.length === 0 ? (
            <Typography sx={{ color: "text.secondary" }}>{emptyText}</Typography>
          ) : null}

          {entries.map((balance) => (
            <Box
              key={`${keyPrefix}-${balance.userId}`}
              sx={{ py: 0.8, borderBottom: "1px solid rgba(26,45,74,0.08)", display: "flex", justifyContent: "space-between", gap: 1.2 }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{balance.username}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{balance.email}</Typography>
              </Box>
              <Typography sx={{ fontWeight: 800, color: amountColor }}>{formatMoney(balance.amount)}</Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [token] = useState<string | null>(getToken);

  const loadDashboard = useCallback(async () => {
    try {
      const auth = token ? { token } : {};
      const [dashboardSummary, groupsData] = await Promise.all([
        fetchFromBackend<DashboardSummary>("/dashboard", auth),
        fetchFromBackend<{ groups: GroupSummary[] }>("/groups", auth),
      ]);

      setDashboard(dashboardSummary);
      setGroups(groupsData.groups);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load dashboard.");
    }
  }, [token]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 7000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  useEffect(() => {
    const handleBackendUpdate = () => {
      void loadDashboard();
    };

    window.addEventListener("splitmates:backend-update", handleBackendUpdate);
    return () => window.removeEventListener("splitmates:backend-update", handleBackendUpdate);
  }, [loadDashboard]);

  const groupsById = useMemo(() => {
    return new Map(groups.map((group) => [group.id, group]));
  }, [groups]);

  const dashboardGroups = dashboard?.groups ?? [];

  const overviewStats = [
    {
      label: "Total Spent",
      value: formatMoney(dashboard?.overall.totalSpent ?? 0),
      tone: "#1f5f9f",
      bg: "rgba(225, 238, 253, 0.95)",
    },
    {
      label: "Owed To You",
      value: formatMoney(dashboard?.overall.totalOwedToYou ?? 0),
      tone: "#1e7f5a",
      bg: "rgba(224, 246, 236, 0.95)",
    },
    {
      label: "You Owe",
      value: formatMoney(dashboard?.overall.totalYouOwe ?? 0),
      tone: "#be5f30",
      bg: "rgba(255, 238, 224, 0.95)",
    },
  ];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(105deg, rgba(248,233,255,0.95) 0%, rgba(241,226,255,0.94) 44%, rgba(227,246,255,0.94) 100%)",
      }}
    >
      <AppNavbar />
      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={2.4}>
          <Box sx={{ pb: 1.3, borderBottom: "1px solid rgba(23,49,84,0.13)" }}>
            <Typography variant="h2" sx={{ fontSize: { xs: 42, md: 58 }, fontWeight: 900, lineHeight: 0.96 }}>
              Dashboard
            </Typography>
          </Box>

          {errorMessage ? (
            <Typography sx={{ color: "#c43e57", fontWeight: 700 }}>{errorMessage}</Typography>
          ) : null}

          <Box sx={{ display: "grid", gap: 1.4, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" } }}>
            {overviewStats.map((stat) => (
              <Card key={stat.label} sx={{ borderRadius: 1, background: "rgba(255,255,255,0.86)", border: "1px solid rgba(143,73,194,0.16)" }}>
                <CardContent sx={{ px: 2.2, py: 2 }}>
                  <Typography sx={{ color: "#7f8ca2", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 12 }}>
                    {stat.label}
                  </Typography>
                  <Typography sx={{ mt: 0.7, color: stat.tone, fontSize: { xs: 28, md: 34 }, fontWeight: 900, lineHeight: 1.05 }}>
                    {stat.value}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Stack spacing={2}>
            <BalanceList
              title="You Owe"
              entries={dashboard?.overall.youOweTo ?? []}
              amountColor="#b14a63"
              emptyText="You currently owe no one."
              keyPrefix="owe"
            />
            <BalanceList
              title="Owes You"
              entries={dashboard?.overall.othersOweToYou ?? []}
              amountColor="#1e7f5a"
              emptyText="No one owes you right now."
              keyPrefix="owed"
            />
          </Stack>

          <Card sx={{ borderRadius: 1, background: "rgba(255,255,255,0.9)", border: "1px solid rgba(31,53,86,0.08)" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
                Group Balances
              </Typography>
              <Stack spacing={1.3}>
                {dashboardGroups.length === 0 ? (
                  <Typography sx={{ color: "text.secondary" }}>No groups found yet.</Typography>
                ) : null}

                {dashboardGroups.map((groupBalance) => {
                  const fullGroup = groupsById.get(groupBalance.groupId);
                  const membersCount = fullGroup?.members.filter(Boolean).length ?? 0;

                  return (
                    <Box key={groupBalance.groupId} sx={{ p: 1.6, border: "1px solid rgba(34,58,90,0.1)", borderRadius: 1, bgcolor: "rgba(247,251,255,0.9)" }}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.4}
                        sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}
                      >
                        <Box>
                          <Typography sx={{ fontWeight: 800, fontSize: 20 }}>{groupBalance.groupName}</Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {groupBalance.category} {membersCount > 0 ? `· ${membersCount} members` : ""}
                          </Typography>
                        </Box>

                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                          <Chip label={`Spent ${formatMoney(groupBalance.totalSpent)}`} sx={{ bgcolor: "rgba(58,120,191,0.12)", color: "#2a5f9e", fontWeight: 700 }} />
                          <Button component={Link} href={`/groups/${groupBalance.groupId}`} variant="outlined" sx={{ borderRadius: 1 }}>
                            Open
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
