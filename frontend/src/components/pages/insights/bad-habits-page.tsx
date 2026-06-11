"use client";

import { useCallback, useEffect, useState } from "react";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WhatshotRoundedIcon from "@mui/icons-material/WhatshotRounded";
import {
  Box, Card, CardContent, Chip, CircularProgress,
  Container, LinearProgress, Stack, ToggleButton,
  ToggleButtonGroup, Typography,
} from "@mui/material";
import { AppNavbar } from "@/components/navigation/app-navbar";
import { fetchFromBackend } from "@/lib/backend-api";
import { getToken } from "@/lib/auth-storage";

interface CategoryData { category: string; amount: number; count: number }
interface BadHabitsData {
  period: string; totalSpent: number; monthlyAvg: number;
  byCategory: CategoryData[];
  projections: { saved: number; invested1Year: number; invested5Years: number; invested10Years: number; invested20Years: number };
}
type Period = "month" | "6months" | "year";

const ITEMS = [

  { cat: "experiences", emoji: "🎬", label: "Cinema + snacks",            price: 50   },
  { cat: "experiences", emoji: "🎭", label: "Ballet show ticket",          price: 200  },
  { cat: "experiences", emoji: "🎵", label: "Concert ticket",              price: 300  },
  { cat: "experiences", emoji: "🍽️", label: "Fine dining meal",            price: 400  },

  { cat: "health",      emoji: "🏋️", label: "Gym membership (1 month)",    price: 180  },
  { cat: "health",      emoji: "🦷", label: "Dental check-up & cleaning",  price: 250  },
  { cat: "health",      emoji: "🩺", label: "Full medical check-up",       price: 300  },
  { cat: "health",      emoji: "🧖", label: "Full day at a SPA",           price: 350  },
  { cat: "health",      emoji: "🏃", label: "Personal trainer (4 sessions)", price: 600 },
  { cat: "health",      emoji: "🌿", label: "Wellness retreat (3 nights)", price: 2000 },

  { cat: "tech",        emoji: "🎵", label: "AirPods Pro 2",               price: 950  },
  { cat: "tech",        emoji: "🎮", label: "Nintendo Switch 2",           price: 2499 },
  { cat: "tech",        emoji: "🎮", label: "PS5 Console",                 price: 2900 },
  { cat: "tech",        emoji: "📱", label: "Samsung Galaxy S25",          price: 3675 },
  { cat: "tech",        emoji: "📱", label: "iPhone 17",                   price: 4370 },
  { cat: "tech",        emoji: "💻", label: "Gaming Laptop",               price: 5000 },

  { cat: "travel",      emoji: "✈️", label: "Flight to Italy",       price: 250  },
  { cat: "travel",      emoji: "🌊", label: "Weekend at the seaside",      price: 1000 },
  { cat: "travel",      emoji: "🏝️", label: "5-days holiday in Greece",    price: 5500 },
  { cat: "travel",      emoji: "🏝️", label: "7-nights vacation in Maldives",          price: 7140 },

  { cat: "growth",      emoji: "📚", label: "Book",             price: 60   },
  { cat: "growth",      emoji: "🎓", label: "Online course",  price: 120  },
  { cat: "growth",      emoji: "🗣️", label: "Language class (1 month)",    price: 400  },
  { cat: "growth",      emoji: "📝", label: "Professional certification",  price: 1200 },
];

const CAT_META: Record<string, { label: string; color: string }> = {
  experiences: { label: "Experiences",       color: "#e83ea8" },
  health:      { label: "Health & Wellness",  color: "#10b981" },
  tech:        { label: "Tech",               color: "#8b5cf6" },
  travel:      { label: "Travel",             color: "#56c9ef" },
  growth:      { label: "Personal Growth",     color: "#f59e0b" },
};

const HABIT_META: Record<string, { label: string; emoji: string; color: string }> = {
  alcohol:         { label: "Alcohol",         emoji: "🍺", color: "#f59e0b" },
  gambling:        { label: "Gambling",        emoji: "🎰", color: "#ef4444" },
  smoking:         { label: "Smoking",         emoji: "🚬", color: "#9ca3af" },
  fast_food:       { label: "Fast food",       emoji: "🍔", color: "#f97316" },
  luxury:          { label: "Luxury",          emoji: "💎", color: "#a78bfa" },
  online_shopping: { label: "Online shopping", emoji: "📦", color: "#60a5fa" },
  subscriptions:   { label: "Subscriptions",  emoji: "📱", color: "#34d399" },
};

const PERIOD_LABELS: Record<Period, string> = {
  month: "This month", "6months": "Last 6 months", year: "Last year",
};

function fmt(n: number) {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n) + " RON";
}

export function BadHabitsPage() {
  const [token] = useState<string | null>(getToken);
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<BadHabitsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (p: Period) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchFromBackend<BadHabitsData>(`/insights/bad-habits?period=${p}`, { token });
      setData(res);
    } catch {  } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void fetchData(period); }, [fetchData, period]);

  const total = data?.totalSpent ?? 0;
  const monthly = data ? (data.monthlyAvg > 0 ? data.monthlyAvg : data.totalSpent) : 0;
  const affordable = ITEMS.filter((i) => total >= i.price).sort((a, b) => b.price - a.price);
  const maxCat = data?.byCategory[0]?.amount ?? 1;

  const byCat: Record<string, typeof ITEMS> = {};
  for (const item of affordable) {
    if (!byCat[item.cat]) byCat[item.cat] = [];
    byCat[item.cat].push(item);
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "transparent" }}>
      <AppNavbar />
      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>

        <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", mb: 4, gap: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>Bad spending habits</Typography>
          <ToggleButtonGroup
            value={period} exclusive
            onChange={(_, v) => { if (v) setPeriod(v as Period); }}
            sx={{ bgcolor: "rgba(255,255,255,0.05)", borderRadius: "12px !important", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}
          >
            {(["month", "6months", "year"] as Period[]).map((p) => (
              <ToggleButton key={p} value={p} sx={{
                px: 2.5, py: 0.9, fontWeight: 700, fontSize: 13, border: "none", borderRadius: "10px !important",
                color: "rgba(255,255,255,0.45)",
                "&.Mui-selected": { bgcolor: "rgba(232,62,168,0.2) !important", color: "#e83ea8" },
                "&:hover": { bgcolor: "rgba(255,255,255,0.07)" },
              }}>
                {PERIOD_LABELS[p]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        {loading ? (
          <Box sx={{ py: 16, display: "flex", justifyContent: "center" }}>
            <CircularProgress sx={{ color: "#e83ea8" }} />
          </Box>
        ) : !data || total === 0 ? (
          <Card sx={{ bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, textAlign: "center" }}>
            <CardContent sx={{ py: 10 }}>
              <Typography sx={{ fontSize: 60 }}>🎉</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: 24, mt: 1.5 }}>No bad habits this period!</Typography>
              <Typography variant="body1" sx={{ color: "text.secondary", mt: 0.5 }}>You were an absolute saint.</Typography>
            </CardContent>
          </Card>
        ) : (

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "380px 1fr" }, gap: { xs: 3, lg: 10 }, alignItems: "start" }}>

            <Stack spacing={2.5}>

              <Card sx={{
                background: "linear-gradient(145deg, rgba(232,62,168,0.22) 0%, rgba(111,41,198,0.18) 100%)",
                border: "1px solid rgba(232,62,168,0.25)", borderRadius: 3,
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                    Wasted — {PERIOD_LABELS[period].toLowerCase()}
                  </Typography>
                  <Typography sx={{
                    fontSize: { xs: 44, md: 52 }, fontWeight: 900, lineHeight: 1.05, mt: 0.5,
                    background: "linear-gradient(90deg, #e83ea8 0%, #a78bfa 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}>
                    {fmt(total)}
                  </Typography>
                  {data.monthlyAvg > 0 && period !== "month" && (
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)", mt: 0.5 }}>
                      ~{fmt(data.monthlyAvg)} / month on average
                    </Typography>
                  )}
                </CardContent>
              </Card>

              <Card sx={{
                background: "linear-gradient(145deg, rgba(86,201,239,0.12) 0%, rgba(111,41,198,0.12) 100%)",
                border: "1px solid rgba(86,201,239,0.18)", borderRadius: 3,
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                    <TrendingUpRoundedIcon sx={{ color: "#56c9ef", fontSize: 20 }} />
                    <Typography sx={{ fontWeight: 800, fontSize: 15 }}>If you invested instead</Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.35)", display: "block", mb: 2.5 }}>
                    {fmt(monthly)} / month · 7% annual return · compounded
                  </Typography>
                  <Stack spacing={1.5}>
                    {[
                      { label: "1 year",   value: data.projections.invested1Year,   pct: 15 },
                      { label: "5 years",  value: data.projections.invested5Years,  pct: 50 },
                      { label: "10 years", value: data.projections.invested10Years, pct: 100 },
                    ].map((item) => (
                      <Box key={item.label}>
                        <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.6 }}>
                          <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600 }}>{item.label}</Typography>
                          <Typography sx={{ color: "#56c9ef", fontWeight: 800, fontSize: 14 }}>{fmt(item.value)}</Typography>
                        </Stack>
                        <LinearProgress variant="determinate" value={item.pct} sx={{
                          height: 4, borderRadius: 99,
                          bgcolor: "rgba(255,255,255,0.07)",
                          "& .MuiLinearProgress-bar": {
                            background: "linear-gradient(90deg, #56c9ef, #8b5cf6)",
                            borderRadius: 99,
                          },
                        }} />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {data.byCategory.length > 0 && (
                <Card sx={{ bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 2 }}>Where the money went</Typography>
                    <Stack spacing={2}>
                      {data.byCategory.map((cat) => {
                        const m = HABIT_META[cat.category] ?? { label: cat.category, emoji: "💸", color: "#9ca3af" };
                        const pct = Math.round((cat.amount / maxCat) * 100);
                        return (
                          <Box key={cat.category}>
                            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
                              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                <Typography sx={{ fontSize: 18 }}>{m.emoji}</Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{m.label}</Typography>
                                <Typography sx={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{cat.count}×</Typography>
                              </Stack>
                              <Typography sx={{ color: m.color, fontWeight: 800, fontSize: 13 }}>{fmt(cat.amount)}</Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={pct} sx={{
                              height: 5, borderRadius: 99,
                              bgcolor: "rgba(255,255,255,0.07)",
                              "& .MuiLinearProgress-bar": { bgcolor: m.color, borderRadius: 99 },
                            }} />
                          </Box>
                        );
                      })}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>

            <Box>
              {Object.keys(byCat).length > 0 ? (
                <Stack spacing={3}>
                  <Typography sx={{ fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.4)" }}>
                    Things you could've bought instead
                  </Typography>
                  {Object.entries(byCat).map(([cat, items]) => {
                    const meta = CAT_META[cat] ?? { label: cat, color: "#9ca3af" };
                    return (
                      <Box key={cat}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
                          <Box sx={{ width: 3, height: 18, borderRadius: 99, bgcolor: meta.color, flexShrink: 0 }} />
                          <Typography sx={{ fontWeight: 800, fontSize: 13, color: meta.color, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            {meta.label}
                          </Typography>
                        </Stack>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(3, 1fr)" }, gap: 1.2 }}>
                          {items.map((item) => {
                            const count = Math.floor(total / item.price);
                            return (
                              <Card key={item.label} sx={{
                                bgcolor: "rgba(255,255,255,0.04)",
                                border: `1px solid rgba(255,255,255,0.08)`,
                                borderRadius: 2.5,
                                transition: "all 0.18s",
                                "&:hover": {
                                  bgcolor: `${meta.color}12`,
                                  borderColor: `${meta.color}40`,
                                  transform: "translateY(-2px)",
                                  boxShadow: `0 8px 24px ${meta.color}18`,
                                },
                              }}>
                                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                  <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                                    <Box sx={{
                                      width: 44, height: 44, borderRadius: 2, flexShrink: 0,
                                      bgcolor: `${meta.color}15`,
                                      display: "grid", placeItems: "center", fontSize: 22,
                                    }}>
                                      {item.emoji}
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography sx={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {item.label}
                                      </Typography>
                                      <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 12, mt: 0.2, fontWeight: 600 }}>
                                        {fmt(item.price)}
                                      </Typography>
                                    </Box>
                                    {count > 1 && (
                                      <Chip
                                        label={`×${count}`}
                                        size="small"
                                        sx={{
                                          bgcolor: `${meta.color}20`, color: meta.color,
                                          fontWeight: 800, fontSize: 12,
                                          border: `1px solid ${meta.color}35`,
                                          flexShrink: 0,
                                        }}
                                      />
                                    )}
                                  </Stack>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 200 }}>
                  <Typography sx={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
                    You're doing great — no bad habits spending detected!
                  </Typography>
                </Box>
              )}
            </Box>

          </Box>
        )}
      </Container>
    </Box>
  );
}
