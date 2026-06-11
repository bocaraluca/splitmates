"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Chip, CircularProgress, Container, LinearProgress, Stack, Typography } from "@mui/material";
import { AppNavbar } from "@/components/navigation/app-navbar";
import { fetchFromBackend } from "@/lib/backend-api";
import { getToken } from "@/lib/auth-storage";
import type { CategoryStat, DashboardSummary, GroupBalance, GroupSummary, MonthStat, UserBalance } from "@/lib/types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(value);
}

const CATEGORY_COLORS: Record<string, string> = {
  groceries:       "#56a069",
  food:            "#f07a2b",
  fast_food:       "#f97316",
  alcohol:         "#f59e0b",
  transport:       "#0f8f93",
  entertainment:   "#d7568f",
  utilities:       "#2f78c9",
  online_shopping: "#60a5fa",
  subscriptions:   "#34d399",
  luxury:          "#a78bfa",
  smoking:         "#9ca3af",
  gambling:        "#ef4444",
  rent:            "#638fc6",
  other:           "#8c96a4",
};

const GROUP_COLORS = [
  "#e83ea8", "#8b5cf6", "#56c9ef", "#34d399", "#f59e0b",
  "#f97316", "#60a5fa", "#a78bfa", "#10b981", "#fb923c",
];

function buildConicGradient(slices: { percentage: number; color: string }[]) {
  if (!slices.length) return "conic-gradient(rgba(255,255,255,0.1) 0 100%)";
  let cursor = 0;
  const segments = slices.map(({ percentage, color }) => {
    const next = cursor + percentage;
    const seg = `${color} ${cursor.toFixed(1)}% ${next.toFixed(1)}%`;
    cursor = next;
    return seg;
  });
  if (cursor < 100) segments.push(`rgba(255,255,255,0.08) ${cursor.toFixed(1)}% 100%`);
  return `conic-gradient(${segments.join(", ")})`;
}

function PieChart({ gradient, size = 160 }: { gradient: string; size?: number }) {
  return (
    <Box sx={{
      width: size, height: size, borderRadius: "50%",
      background: gradient, flexShrink: 0, position: "relative",
      "&::after": {
        content: '""', position: "absolute",
        inset: "22%", borderRadius: "50%",
        background: "rgba(10,5,30,0.85)",
      },
    }} />
  );
}

function BalanceList({ title, entries, amountColor, emptyText, keyPrefix, groupBalances, groups, token, mode, currentUserId, myStripeAccountId }: {
  title: string; entries: UserBalance[]; amountColor: string; emptyText: string; keyPrefix: string;
  groupBalances: GroupBalance[]; groups: GroupSummary[]; token: string | null; mode: "owe" | "owed"; currentUserId: number | null; myStripeAccountId: string | null;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msgId, setMsgId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function findGroupId(userId: number): number | null {

    for (const g of groupBalances) {
      const list = mode === "owe" ? g.youOweTo : g.othersOweToYou;
      if (list.some(b => Number(b.userId) === userId)) return Number(g.groupId);
    }

    for (const g of groups) {
      if (g.members.some(m => m && Number(m.id) === userId)) return Number(g.id);
    }
    return null;
  }

  async function handlePayStripe(b: UserBalance) {
    if (!token || !currentUserId) return;
    const groupId = findGroupId(Number(b.userId));
    if (!groupId) return;
    setBusyId(Number(b.userId));
    setErrorMsg(null);
    try {
      await fetchFromBackend(`/groups/${groupId}/payments/stripe`, {
        method: "POST", token,
        body: JSON.stringify({ fromUserId: currentUserId, toUserId: Number(b.userId), amount: b.amount }),
      });
      setMsgId(Number(b.userId));
      setTimeout(() => setMsgId(null), 2500);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Payment failed.");
    } finally { setBusyId(null); }
  }

  async function handleMarkPaid(b: UserBalance) {
    if (!token || !currentUserId) return;
    const groupId = findGroupId(Number(b.userId));
    if (!groupId) return;
    setBusyId(Number(b.userId));
    setErrorMsg(null);
    try {
      await fetchFromBackend(`/groups/${groupId}/payments`, {
        method: "POST", token,
        body: JSON.stringify({ fromUserId: currentUserId, toUserId: Number(b.userId), amount: b.amount }),
      });
      setMsgId(Number(b.userId));
      setTimeout(() => setMsgId(null), 2500);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Payment failed.");
    } finally { setBusyId(null); }
  }

  async function handleRequest(b: UserBalance) {
    if (!token) return;
    const groupId = findGroupId(Number(b.userId));
    if (!groupId) return;
    setBusyId(Number(b.userId));
    try {
      await fetchFromBackend(`/groups/${groupId}/payment-requests`, {
        method: "POST", token,
        body: JSON.stringify({ toUserId: Number(b.userId), amount: b.amount }),
      });
      setMsgId(Number(b.userId));
      setTimeout(() => setMsgId(null), 2500);
    } catch {  } finally { setBusyId(null); }
  }

  return (
    <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.4 }}>{title}</Typography>
        {errorMsg && <Typography variant="caption" sx={{ color: "#f87171", fontWeight: 700, display: "block", mb: 1 }}>{errorMsg}</Typography>}
        <Stack spacing={0.9}>
          {entries.length === 0
            ? <Typography sx={{ color: "text.secondary" }}>{emptyText}</Typography>
            : entries.map((balance) => {
              const uid = Number(balance.userId);
              const groupId = findGroupId(uid);
              return (
                <Box key={`${keyPrefix}-${uid}`} sx={{ py: 1, borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{balance.username}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{balance.email}</Typography>
                    {msgId === uid && <Typography variant="caption" sx={{ display: "block", color: "#34d399", fontWeight: 700 }}>Payment successful!</Typography>}
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                    <Typography sx={{ fontWeight: 800, color: amountColor }}>{formatMoney(balance.amount)}</Typography>
                    {groupId && mode === "owe" && (<>
                      {balance.stripeAccountId && myStripeAccountId && (
                        <Button size="small" variant="contained" disabled={busyId === uid}
                          onClick={() => void handlePayStripe(balance)}
                          sx={{ fontWeight: 700, textTransform: "none", fontSize: 12, py: 0.4, px: 1.2, borderRadius: 2, bgcolor: "#635bff", "&:hover": { bgcolor: "#4f49cc" } }}>
                          {busyId === uid ? <CircularProgress size={12} sx={{ color: "white" }} /> : "Pay with Stripe"}
                        </Button>
                      )}
                      <Button size="small" variant="outlined" disabled={busyId === uid}
                        onClick={() => void handleMarkPaid(balance)}
                        sx={{ fontWeight: 700, textTransform: "none", fontSize: 12, py: 0.4, px: 1.2, borderRadius: 2, borderColor: "#34d399", color: "#34d399", "&:hover": { borderColor: "#27ae60", bgcolor: "rgba(52,211,153,0.08)" } }}>
                        {busyId === uid ? <CircularProgress size={12} /> : "Mark as paid"}
                      </Button>
                    </>)}
                    {groupId && mode === "owed" && (
                      <Button size="small" variant="outlined" disabled={busyId === uid}
                        onClick={() => void handleRequest(balance)}
                        sx={{ fontWeight: 700, textTransform: "none", fontSize: 12, py: 0.4, px: 1.2, borderRadius: 2, borderColor: "#a78bfa", color: "#a78bfa", "&:hover": { borderColor: "#8b5cf6", bgcolor: "rgba(167,139,250,0.08)" } }}>
                        {busyId === uid ? <CircularProgress size={12} /> : "Request payment"}
                      </Button>
                    )}
                  </Stack>
                </Box>
              );
            })
          }
        </Stack>
      </CardContent>
    </Card>
  );
}

function CategoryBreakdown({ stats }: { stats: CategoryStat[] }) {
  const top = stats.slice(0, 8);
  const gradient = buildConicGradient(top.map(s => ({ percentage: s.percentage, color: CATEGORY_COLORS[s.category] ?? "#8c96a4" })));

  if (!top.length) return null;

  return (
    <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2.5 }}>Spending by Category</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: { xs: "flex-start", sm: "center" } }}>
          <PieChart gradient={gradient} size={148} />
          <Stack spacing={1.2} sx={{ flex: 1, minWidth: 0 }}>
            {top.map((s) => {
              const color = CATEGORY_COLORS[s.category] ?? "#8c96a4";
              const label = s.category.replace(/_/g, " ");
              return (
                <Box key={s.category}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", textTransform: "capitalize" }}>{label}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color }}>{formatMoney(s.amount)}</Typography>
                      <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{Math.round(s.percentage)}%</Typography>
                    </Stack>
                  </Stack>
                  <LinearProgress variant="determinate" value={s.percentage} sx={{
                    height: 4, borderRadius: 99,
                    bgcolor: "rgba(255,255,255,0.07)",
                    "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 99 },
                  }} />
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function GroupSpending({ groups }: { groups: { name: string; totalSpent: number }[] }) {
  const filtered = groups.filter(g => g.totalSpent > 0);
  if (!filtered.length) return null;

  const total = filtered.reduce((s, g) => s + g.totalSpent, 0);
  const slices = filtered.map((g, i) => ({
    percentage: total > 0 ? (g.totalSpent / total) * 100 : 0,
    color: GROUP_COLORS[i % GROUP_COLORS.length],
  }));
  const gradient = buildConicGradient(slices);

  return (
    <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2.5 }}>Spending by Group</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: { xs: "flex-start", sm: "center" } }}>
          <PieChart gradient={gradient} size={148} />
          <Stack spacing={1.4} sx={{ flex: 1, minWidth: 0 }}>
            {filtered.map((g, i) => {
              const color = GROUP_COLORS[i % GROUP_COLORS.length];
              const pct = total > 0 ? Math.round((g.totalSpent / total) * 100) : 0;
              return (
                <Stack key={g.name} direction="row" sx={{ alignItems: "center", gap: 1.2 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                  <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color }}>{formatMoney(g.totalSpent)}</Typography>
                  <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 600, minWidth: 32, textAlign: "right" }}>{pct}%</Typography>
                </Stack>
              );
            })}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function MonthlyTrend({ months }: { months: MonthStat[] }) {
  const max = Math.max(...months.map(m => m.amount), 1);
  if (months.every(m => m.amount === 0)) return null;

  return (
    <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2.5 }}>Monthly spending (last 6 months)</Typography>
        <Box sx={{ overflowX: "auto", pb: 0.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end", minWidth: months.length * 60 }}>
            {months.map((m) => {
              const barH = Math.max(6, (m.amount / max) * 140);
              return (
                <Box key={m.month} sx={{ flex: 1, minWidth: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                  <Typography sx={{ fontSize: 10, color: "#e83ea8", fontWeight: 800, whiteSpace: "nowrap", minHeight: 14 }}>
                    {m.amount > 0 ? formatMoney(m.amount) : ""}
                  </Typography>
                  <Box sx={{
                    width: "75%", height: barH, minHeight: 6,
                    background: "linear-gradient(180deg, #e83ea8, #8b5cf6)",
                    borderRadius: "4px 4px 0 0", transition: "height 0.3s ease",
                  }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{m.month}</Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [myStripeAccountId, setMyStripeAccountId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [token] = useState<string | null>(getToken);

  const loadDashboard = useCallback(async () => {
    try {
      const auth = token ? { token } : {};
      const [dashboardSummary, groupsData, profileData] = await Promise.all([
        fetchFromBackend<DashboardSummary>("/dashboard", auth),
        fetchFromBackend<{ groups: GroupSummary[] }>("/groups", auth),
        fetchFromBackend<{ user: { stripeAccountId: string | null } }>("/profile", auth),
      ]);
      setDashboard(dashboardSummary);
      setGroups(groupsData.groups);
      setMyStripeAccountId(profileData.user.stripeAccountId);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load dashboard.");
    }
  }, [token]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadDashboard(); }, 0);
    const interval = window.setInterval(() => { void loadDashboard(); }, 7000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); };
  }, [loadDashboard]);

  useEffect(() => {
    const handleBackendUpdate = () => { void loadDashboard(); };
    window.addEventListener("splitmates:backend-update", handleBackendUpdate);
    return () => window.removeEventListener("splitmates:backend-update", handleBackendUpdate);
  }, [loadDashboard]);

  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const dashboardGroups = dashboard?.groups ?? [];

  const overviewStats = [
    { label: "Total Spent",   value: formatMoney(dashboard?.overall.totalSpent ?? 0),    tone: "#60a5fa", accent: "rgba(96,165,250,0.15)" },
    { label: "Owed To You",   value: formatMoney(dashboard?.overall.totalOwedToYou ?? 0), tone: "#34d399", accent: "rgba(52,211,153,0.15)" },
    { label: "You Owe",       value: formatMoney(dashboard?.overall.totalYouOwe ?? 0),    tone: "#fb923c", accent: "rgba(251,146,60,0.15)" },
  ];

  return (
    <Box sx={{ minHeight: "100vh", background: "transparent" }}>
      <AppNavbar />
      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={2.4}>
          <Box sx={{ pb: 1.3, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <Typography variant="h2" sx={{ fontSize: { xs: 42, md: 58 }, fontWeight: 900, lineHeight: 0.96 }}>
              Dashboard
            </Typography>
          </Box>

          {errorMessage && <Typography sx={{ color: "#c43e57", fontWeight: 700 }}>{errorMessage}</Typography>}

          <Box sx={{ display: "grid", gap: 1.4, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" } }}>
            {overviewStats.map((stat) => (
              <Card key={stat.label} sx={{ borderRadius: 2, background: stat.accent, border: `1px solid ${stat.tone}30` }}>
                <CardContent sx={{ px: 2.2, py: 2 }}>
                  <Typography sx={{ color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 11 }}>
                    {stat.label}
                  </Typography>
                  <Typography sx={{ mt: 0.7, color: stat.tone, fontSize: { xs: 28, md: 34 }, fontWeight: 900, lineHeight: 1.05 }}>
                    {stat.value}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
            <GroupSpending groups={dashboardGroups.map(g => ({ name: g.groupName, totalSpent: g.totalSpent }))} />
            <CategoryBreakdown stats={dashboard?.categoryStats ?? []} />
          </Box>

          <MonthlyTrend months={dashboard?.monthlyStats ?? []} />

          <Stack spacing={2}>
            <BalanceList title="You owe"  entries={dashboard?.overall.youOweTo ?? []}       amountColor="#f87171" emptyText="You currently owe no one."  keyPrefix="owe"  groupBalances={dashboardGroups} groups={groups} token={token} mode="owe"  currentUserId={dashboard?.user?.id ?? null} myStripeAccountId={myStripeAccountId} />
            <BalanceList title="Owes you" entries={dashboard?.overall.othersOweToYou ?? []} amountColor="#34d399" emptyText="No one owes you right now." keyPrefix="owed" groupBalances={dashboardGroups} groups={groups} token={token} mode="owed" currentUserId={dashboard?.user?.id ?? null} myStripeAccountId={myStripeAccountId} />
          </Stack>

          <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Group balances</Typography>
              <Stack spacing={1.3}>
                {dashboardGroups.length === 0
                  ? <Typography sx={{ color: "text.secondary" }}>No groups found yet.</Typography>
                  : dashboardGroups.map((groupBalance) => {
                      const fullGroup = groupsById.get(groupBalance.groupId);
                      const membersCount = fullGroup?.members.filter(Boolean).length ?? 0;
                      return (
                        <Box key={groupBalance.groupId} sx={{ p: 1.6, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)" }}>
                          <Stack direction={{ xs: "column", md: "row" }} spacing={1.4} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: 20 }}>{groupBalance.groupName}</Typography>
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                {groupBalance.category}{membersCount > 0 ? ` · ${membersCount} members` : ""}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                              <Chip label={`Spent ${formatMoney(groupBalance.totalSpent)}`} sx={{ bgcolor: "rgba(96,165,250,0.15)", color: "#60a5fa", fontWeight: 700 }} />
                              <Button component={Link} href={`/groups/${groupBalance.groupId}`} variant="outlined" sx={{ borderRadius: 1 }}>
                                Open
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })
                }
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
