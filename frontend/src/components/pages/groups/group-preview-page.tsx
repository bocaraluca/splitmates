"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography,
} from "@mui/material";
import { AppNavbar } from "@/components/navigation/app-navbar";
import { fetchFromBackend, markExpenseDeleted } from "@/lib/backend-api";
import { getRole, getToken } from "@/lib/auth-storage";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import type { BalanceSummary, DashboardSummary, ExpenseCategory, ExpenseListResponse, GroupStats, GroupSummary } from "@/lib/types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "RON", maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(new Date(value));
}

const INFINITE_SCROLL_PAGE_SIZE = 20;

export function GroupPreviewPage({ groupId, initialTab }: { groupId: number; initialTab?: "expenses" | "settlements" | "members" }) {
  const router = useRouter();
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseListResponse | null>(null);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [tabValue, setTabValue] = useState<"expenses" | "settlements" | "members">(initialTab ?? "expenses");
  const [balances, setBalances] = useState<BalanceSummary | null>(null);
  const [myStripeAccountId, setMyStripeAccountId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [stripePayingId, setStripePayingId] = useState<number | null>(null);
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);

  const [groupError, setGroupError] = useState<string | null>(null);
  const [token] = useState<string | null>(getToken);
  const [newMemberIdentifier, setNewMemberIdentifier] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [groupActionBusy, setGroupActionBusy] = useState(false);
  const [appRole] = useState<string | null>(getRole);
  const [expensePage, setExpensePage] = useState(1);
  const [expenseSortBy, setExpenseSortBy] = useState<"date" | "amount">("date");
  const [expenseSortOrder, setExpenseSortOrder] = useState<"asc" | "desc">("desc");
  const [expenseCategory, setExpenseCategory] = useState<"all" | ExpenseCategory>("all");
  const [expensePaidByUserId, setExpensePaidByUserId] = useState<"all" | number>("all");
  const [expenseDeletingId, setExpenseDeletingId] = useState<number | null>(null);
  const [expenseItems, setExpenseItems] = useState<ExpenseListResponse["items"]>([]);
  const [expenseTotalPages, setExpenseTotalPages] = useState(1);
  const [isLoadingMoreExpenses, setIsLoadingMoreExpenses] = useState(false);
  const [prefetchedExpenses, setPrefetchedExpenses] = useState<{ page: number; response: ExpenseListResponse } | null>(null);
  const expenseLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const isAppAdmin = appRole === "admin";
  const canManageGroup = Boolean(group?.isAdmin || isAppAdmin);

  const fetchExpensePage = useCallback(async (page: number) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(INFINITE_SCROLL_PAGE_SIZE),
      sortBy: expenseSortBy,
      sortOrder: expenseSortOrder,
    });

    if (expenseCategory !== "all") {
      params.set("category", expenseCategory);
    }

    if (expensePaidByUserId !== "all") {
      params.set("paidByUserId", String(expensePaidByUserId));
    }

    return fetchFromBackend<ExpenseListResponse>(`/groups/${groupId}/expenses?${params.toString()}`, token ? { token } : {});
  }, [expenseCategory, expensePaidByUserId, expenseSortBy, expenseSortOrder, groupId, token]);

  const loadExpensesStatsAndHealth = useCallback(async () => {
    try {
      const auth = token ? { token } : {};

      const [expensesResponse, statsResponse, balancesResponse] = await Promise.all([
        fetchExpensePage(1),
        fetchFromBackend<{ stats: GroupStats }>(`/groups/${groupId}/stats`, auth),
        fetchFromBackend<{ summary: BalanceSummary }>(`/groups/${groupId}/balances`, auth),
      ]);

      setExpenses(expensesResponse);
      setExpenseItems(expensesResponse.items);
      setExpensePage(1);
      setExpenseTotalPages(expensesResponse.totalPages);
      setPrefetchedExpenses(null);

      setStats(statsResponse.stats);
      setBalances(balancesResponse.summary);
      setGroupError(null);
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Unable to load group details.");
    }
  }, [fetchExpensePage, groupId, token]);

  const loadGroupPreviewData = useCallback(async () => {
    try {
      const auth = token ? { token } : {};
      const [groupResponse, profileResponse] = await Promise.all([
        fetchFromBackend<{ group: GroupSummary; dashboard: DashboardSummary | null }>(`/groups/${groupId}`, auth),
        fetchFromBackend<{ user: { id: number; stripeAccountId: string | null } }>("/profile", auth),
      ]);
      setGroup(groupResponse.group);
      setMyStripeAccountId(profileResponse.user.stripeAccountId);
      setMyUserId(profileResponse.user.id);
      await loadExpensesStatsAndHealth();
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Unable to load group details.");
    }
  }, [groupId, loadExpensesStatsAndHealth, token]);

  useEffect(() => {
    Promise.resolve().then(() => loadGroupPreviewData());
  }, [loadGroupPreviewData]);

  const loadMoreExpenses = useCallback(async () => {
    if (isLoadingMoreExpenses || expensePage >= expenseTotalPages) {
      return;
    }

    setIsLoadingMoreExpenses(true);
    try {
      const nextPage = expensePage + 1;
      const nextResponse = prefetchedExpenses?.page === nextPage ? prefetchedExpenses.response : await fetchExpensePage(nextPage);

      setExpenseItems((previous) => {
        const seen = new Set(previous.map((item) => item.id));
        const nextItems = nextResponse.items.filter((item) => !seen.has(item.id));
        return previous.concat(nextItems);
      });
      setExpensePage(nextPage);
      setExpenses(nextResponse);
      setExpenseTotalPages(nextResponse.totalPages);
      setPrefetchedExpenses(null);

      if (nextPage < nextResponse.totalPages) {
        const prefetched = await fetchExpensePage(nextPage + 1);
        setPrefetchedExpenses({ page: nextPage + 1, response: prefetched });
      }
    } catch {
      setGroupError("Unable to load more expenses.");
    } finally {
      setIsLoadingMoreExpenses(false);
    }
  }, [expensePage, expenseTotalPages, fetchExpensePage, isLoadingMoreExpenses, prefetchedExpenses]);

  useEffect(() => {
    const anchor = expenseLoadMoreRef.current;
    if (!anchor) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void loadMoreExpenses();
      }
    }, { rootMargin: "240px 0px" });

    observer.observe(anchor);
    return () => observer.disconnect();
  }, [loadMoreExpenses]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleBackendUpdate = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!touchesCurrentGroup(detail, groupId)) return;

      const payload = detail as { type?: unknown } | undefined;
      const type = typeof payload?.type === "string" ? payload.type : "";

      if (type.startsWith("group.")) {
        void loadGroupPreviewData();
        return;
      }

      void loadExpensesStatsAndHealth();
    };

    window.addEventListener("splitmates:backend-update", handleBackendUpdate);
    return () => {
      window.removeEventListener("splitmates:backend-update", handleBackendUpdate);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [groupId, loadExpensesStatsAndHealth, loadGroupPreviewData]);

  const categoryBreakdown = useMemo(() => {
    if (!stats?.categories?.length) {
      return [];
    }

    return stats.categories.filter((item) => item.amount > 0);
  }, [stats]);

  const monthlyBreakdown = useMemo(() => {
    return stats?.months ?? [];
  }, [stats]);

  const highestMonthlyAmount = useMemo(() => {
    if (!monthlyBreakdown.length) {
      return 1;
    }

    return Math.max(...monthlyBreakdown.map((item) => item.amount), 1);
  }, [monthlyBreakdown]);

  const spendingRing = useMemo(() => {
    if (!categoryBreakdown.length) {
      return "conic-gradient(#d6deea 0 100%)";
    }

    let cursor = 0;
    const segments = categoryBreakdown.map((item) => {
      const next = cursor + item.percentage;
      const segment = `${categoryColor(item.category)} ${cursor.toFixed(2)}% ${next.toFixed(2)}%`;
      cursor = next;
      return segment;
    });

    if (cursor < 100) {
      segments.push(`#d6deea ${cursor.toFixed(2)}% 100%`);
    }

    return `conic-gradient(${segments.join(",")})`;
  }, [categoryBreakdown]);

  async function handleMemberAdd() {
    const identifier = newMemberIdentifier.trim();
    if (!identifier) {
      return;
    }

    setMemberBusy(true);
    try {
      await fetchFromBackend(`/groups/${groupId}/members`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({ identifier }),
      });
      setNewMemberIdentifier("");
      await loadGroupPreviewData();
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Unable to add member.");
    } finally {
      setMemberBusy(false);
    }
  }

  async function handleMemberRemove(userId: number) {
    setMemberBusy(true);
    try {
      await fetchFromBackend(`/groups/${groupId}/members`, {
        method: "DELETE",
        token: token ?? undefined,
        body: JSON.stringify({ userId }),
      });
      await loadGroupPreviewData();
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Unable to remove member.");
    } finally {
      setMemberBusy(false);
    }
  }

  async function handleLeaveGroup() {
    if (!window.confirm("Leave this group?")) {
      return;
    }

    setGroupActionBusy(true);
    try {
      await fetchFromBackend(`/groups/${groupId}/leave`, {
        method: "POST",
        token: token ?? undefined,
      });
      router.push("/groups");
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Unable to leave group.");
    } finally {
      setGroupActionBusy(false);
    }
  }

  async function handleDeleteGroup() {
    if (!window.confirm("Delete this group? This action cannot be undone.")) {
      return;
    }

    setGroupActionBusy(true);
    try {
      await fetchFromBackend(`/groups/${groupId}`, {
        method: "DELETE",
        token: token ?? undefined,
      });
      router.push("/groups");
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Unable to delete group.");
    } finally {
      setGroupActionBusy(false);
    }
  }

  async function handleStripePayment(toUserId: number, amount: number) {
    if (!token || !myUserId) return;

    setStripePayingId(toUserId);
    setPayError(null);
    setPaySuccess(null);
    try {
      await fetchFromBackend(`/groups/${groupId}/payments/stripe`, {
        method: "POST",
        token,
        body: JSON.stringify({ fromUserId: myUserId, toUserId, amount }),
      });
      setPaySuccess("Payment successful!");
      await loadExpensesStatsAndHealth();
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Payment failed.");
    } finally {
      setStripePayingId(null);
    }
  }

  async function handleManualPayment(toUserId: number, amount: number) {
    if (!token || !myUserId) return;

    setStripePayingId(toUserId);
    setPayError(null);
    setPaySuccess(null);
    try {
      await fetchFromBackend(`/groups/${groupId}/payments`, {
        method: "POST",
        token,
        body: JSON.stringify({ fromUserId: myUserId, toUserId, amount }),
      });
      setPaySuccess("Payment marked as paid!");
      await loadExpensesStatsAndHealth();
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Payment failed.");
    } finally {
      setStripePayingId(null);
    }
  }

  async function handlePaymentRequest(toUserId: number, amount: number) {
    if (!token) return;
    setRequestingId(toUserId);
    setPayError(null);
    try {
      await fetchFromBackend(`/groups/${groupId}/payment-requests`, {
        method: "POST",
        token,
        body: JSON.stringify({ toUserId, amount }),
      });
      setPayError(null);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setRequestingId(null);
    }
  }

  async function handleDeleteExpense(expenseId: number) {
    if (!window.confirm("Delete this expense? This action cannot be undone.")) {
      return;
    }

    setExpenseDeletingId(expenseId);
    markExpenseDeleted(groupId, expenseId);
    setExpenseItems((items) => items.filter((item) => item.id !== expenseId));
    setExpenses((current) => {
      if (!current) {
        return null;
      }
      return {
        ...current,
        items: current.items.filter((item) => item.id !== expenseId),
        totalItems: Math.max(0, current.totalItems - 1),
      };
    });
    try {
      await fetchFromBackend(`/groups/${groupId}/expenses/${expenseId}`, {
        method: "DELETE",
        token: token ?? undefined,
      });
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Unable to delete expense.");
    } finally {
      setExpenseDeletingId(null);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "transparent",
        overflowX: "clip",
      }}
    >
      <AppNavbar />
      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={3}>
          <Button
            onClick={() => router.push(isAppAdmin ? "/admin" : "/groups")}
            sx={{ alignSelf: "flex-start", color: "white", fontWeight: 900, fontSize: 22, minWidth: 0, px: 2.2, py: 0.7, backgroundColor: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.22)", backdropFilter: "blur(10px)", borderRadius: 999, "&:hover": { backgroundColor: "rgba(255,255,255,0.24)" } }}
          >
            ←
          </Button>

          <Box
            sx={{
              display: "grid",
              gap: 1.6,
              width: "100%",
              maxWidth: "none",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) auto" },
              alignItems: { lg: "start" },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={3.0} sx={{ alignItems: "flex-start", mb: 0.9 }}>
                <Typography
                  variant="h2"
                  sx={{
                    fontSize: { xs: "clamp(24px, 9vw, 28px)", md: 62 },
                    fontWeight: 900,
                    lineHeight: 0.95,
                    maxWidth: "100%",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  }}
                >
                  {group?.name ?? "Group preview"}
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<ChatRoundedIcon />}
                  onClick={() => router.push(`/groups/${groupId}/chat`)}
                  sx={{
                    borderRadius: 999,
                    minHeight: { xs: 40, md: 46 },
                    px: { xs: 1.4, md: 2 },
                    fontSize: { xs: 11, md: 13 },
                    fontWeight: 800,
                    textTransform: "none",
                    flexShrink: 0,
                    mt: { xs: 0, md: 0 },
                  }}
                >
                  Group chat
                </Button>
              </Stack>
              {group?.description ? (
                <Typography
                  variant="h6"
                  sx={{ color: "text.secondary", fontWeight: 500, maxWidth: 760, fontSize: { xs: 15, md: 22 }, mt: 0.9, overflowWrap: "anywhere" }}
                >
                  {group.description}
                </Typography>
              ) : null}
              {canManageGroup ? (
                <Button
                  variant="outlined"
                  startIcon={<EditRoundedIcon />}
                  sx={{
                    borderRadius: 999,
                    minHeight: { xs: 40, md: 46 },
                    px: { xs: 1.4, md: 1.8 },
                    fontSize: { xs: 12, md: 14 },
                    fontWeight: 900,
                    textTransform: "none",
                    borderColor: "#e83ea8",
                    color: "#e83ea8",
                    bgcolor: "rgba(232,62,168,0.08)",
                    mt: 1.2,
                    whiteSpace: "nowrap",
                    alignSelf: "flex-start",
                    "&:hover": {
                      borderColor: "#d9369b",
                      bgcolor: "rgba(232,62,168,0.18)",
                    },
                  }}
                  onClick={() => router.push(`/groups/${groupId}/edit`)}
                >
                  Edit group
                </Button>
              ) : null}
            </Box>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 0.8, sm: 1.2 }}
              sx={{
                alignItems: { xs: "stretch", sm: "center" },
                justifyContent: { xs: "flex-start", lg: "flex-start" },
                width: { xs: "100%", lg: "auto" },
                mt: { xs: 0.25, lg: 0 },
              }}
            >
              {!isAppAdmin && <Button
                aria-label="Add expense"
                onClick={() => router.push(`/groups/${groupId}/expenses/new`)}
                sx={{
                  width: { xs: 48, md: 72 },
                  height: { xs: 48, md: 72 },
                  minWidth: { xs: 48, md: 72 },
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #5ec9eb, #6f29c6)",
                  color: "white",
                  boxShadow: "0 14px 28px rgba(111, 41, 198, 0.34)",
                  border: "2px solid rgba(255,255,255,0.5)",
                  animation: "floatActionButton 4.4s ease-in-out infinite",
                  transformOrigin: "center",
                  textTransform: "none",
                  position: "relative",
                  overflow: "hidden",
                  "@keyframes floatActionButton": {
                    "0%": { transform: "translate3d(0, 0, 0) scale(1)" },
                    "50%": { transform: "translate3d(0, -8px, 0) scale(1.03)" },
                    "100%": { transform: "translate3d(0, 0, 0) scale(1)" },
                  },
                  "&:hover": {
                    background: "linear-gradient(135deg, #4db9df, #5f22b2)",
                    boxShadow: "0 18px 34px rgba(111, 41, 198, 0.42)",
                  },
                  alignSelf: { xs: "center", sm: "auto" },
                  flex: "0 0 auto",
                }}
                >
                  <AddRoundedIcon sx={{ fontSize: { xs: 24, md: 34 } }} />
                </Button>}
            </Stack>
          </Box>

          {groupError ? (
            <Typography sx={{ color: "#cf2e2e", fontWeight: 700 }}>
              {groupError}
            </Typography>
          ) : null}

          <Box sx={{ borderBottom: "1px solid rgba(46, 58, 86, 0.12)" }}>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ minHeight: 54 }}>
              <Tab
                value="expenses"
                icon={<ReceiptLongRoundedIcon />}
                iconPosition="start"
                label="EXPENSES"
                sx={{ minHeight: 54, fontWeight: 700 }}
              />
              {!isAppAdmin && <Tab
                value="settlements"
                icon={<AccountBalanceWalletRoundedIcon />}
                iconPosition="start"
                label="SETTLEMENTS"
                sx={{ minHeight: 54, fontWeight: 700 }}
              />}
              <Tab
                value="members"
                icon={<GroupRoundedIcon />}
                iconPosition="start"
                label="MEMBERS"
                sx={{ minHeight: 54, fontWeight: 700 }}
              />
            </Tabs>
          </Box>

          {tabValue === "expenses" && (
            <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.55fr) minmax(300px, 0.8fr)" } }}>
              <Card sx={{ borderRadius: 1.5, background: "rgba(255,255,255,0.05)" }}>
                <CardContent sx={{ p: 0 }}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.1} sx={{ p: 1.5, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 150 } }}>
                      <InputLabel id="expense-category-label">Category</InputLabel>
                      <Select
                        labelId="expense-category-label"
                        value={expenseCategory}
                        label="Category"
                        onChange={(event) => {
                          setExpensePage(1);
                          setExpenseCategory(event.target.value as typeof expenseCategory);
                        }}
                      >
                        <MenuItem value="all">All categories</MenuItem>
                        {EXPENSE_CATEGORIES.map((option) => (
                          <MenuItem key={option} value={option}>
                            {readableCategory(option)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 170 } }}>
                      <InputLabel id="expense-paid-by-label">Paid by</InputLabel>
                      <Select
                        labelId="expense-paid-by-label"
                        value={expensePaidByUserId === "all" ? "all" : String(expensePaidByUserId)}
                        label="Paid by"
                        onChange={(event) => {
                          setExpensePage(1);
                          const value = event.target.value;
                          setExpensePaidByUserId(value === "all" ? "all" : Number(value));
                        }}
                      >
                        <MenuItem value="all">All members</MenuItem>
                        {(group?.members ?? [])
                          .filter(Boolean)
                          .map((member) => (
                            <MenuItem key={member!.id} value={String(member!.id)}>
                              {member!.username}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 132 } }}>
                      <InputLabel id="expense-sort-by-label">Sort by</InputLabel>
                      <Select
                        labelId="expense-sort-by-label"
                        value={expenseSortBy}
                        label="Sort by"
                        onChange={(event) => {
                          setExpensePage(1);
                          setExpenseSortBy(event.target.value as "date" | "amount");
                        }}
                      >
                        <MenuItem value="date">Date</MenuItem>
                        <MenuItem value="amount">Amount</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 132 } }}>
                      <InputLabel id="expense-sort-order-label">Order</InputLabel>
                      <Select
                        labelId="expense-sort-order-label"
                        value={expenseSortOrder}
                        label="Order"
                        onChange={(event) => {
                          setExpensePage(1);
                          setExpenseSortOrder(event.target.value as "asc" | "desc");
                        }}
                      >
                        <MenuItem value="desc">Desc</MenuItem>
                        <MenuItem value="asc">Asc</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>

                  <Box sx={{ display: { xs: "none", md: "block" }, overflowX: "auto" }}>
                    <Table
                      sx={{
                        width: "100%",
                        minWidth: 0,
                        tableLayout: "fixed",
                      }}
                    >
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: "32%" }}>Title</TableCell>
                          <TableCell sx={{ width: "20%" }}>Category</TableCell>
                          <TableCell sx={{ width: "14%" }}>Amount</TableCell>
                          <TableCell sx={{ width: "16%" }}>Paid By</TableCell>
                          <TableCell sx={{ width: "18%" }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {expenseItems.map((expense) => (
                          <TableRow key={expense.id} hover sx={expense.isBadHabit ? { borderLeft: "3px solid #f87171" } : {}}>
                            <TableCell>
                              <Stack direction="row" spacing={0.8} sx={{ alignItems: "center" }}>
                                <Typography sx={{ fontWeight: 600 }}>{expense.title}</Typography>
                              </Stack>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {formatDate(expense.date)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={readableCategory(expense.category)}
                                sx={{
                                  bgcolor: `${categoryColor(expense.category)}22`,
                                  color: categoryColor(expense.category),
                                  fontWeight: 700,
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>{formatMoney(expense.amount)}</TableCell>
                            <TableCell>{expense.paidBy?.username ?? "Unknown"}</TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                                <Button
                                  variant="text"
                                  size="small"
                                  aria-label="Edit expense"
                                  sx={{ minWidth: 0, p: 0.5 }}
                                  onClick={() => router.push(`/groups/${groupId}/expenses/${expense.id}`)}
                                >
                                  <EditRoundedIcon sx={{ fontSize: 18 }} />
                                </Button>
                                <Button
                                  variant="text"
                                  size="small"
                                  color="error"
                                  disabled={expenseDeletingId === expense.id}
                                  onClick={() => void handleDeleteExpense(expense.id)}
                                  aria-label="Delete expense"
                                  sx={{ minWidth: 0, p: 0.5 }}
                                >
                                  <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>

                  <Stack spacing={1.2} sx={{ display: { xs: "block", md: "none" }, p: 1.5 }}>
                    {expenseItems.map((expense) => (
                      <Card key={expense.id} sx={{ borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.05)", border: expense.isBadHabit ? "1px solid rgba(248,113,113,0.4)" : "1px solid rgba(255,255,255,0.08)" }}>
                        <CardContent sx={{ p: 1.6 }}>
                          <Stack spacing={1}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.2, alignItems: "flex-start" }}>
                              <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
                                  <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.15 }}>{expense.title}</Typography>
                                </Stack>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                  {formatDate(expense.date)}
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={0.6} sx={{ flexShrink: 0 }}>
                                <Button variant="outlined" size="small" sx={{ whiteSpace: "nowrap" }} onClick={() => router.push(`/groups/${groupId}/expenses/${expense.id}`)}>
                                  Edit
                                </Button>
                                <Button
                                  variant="text"
                                  size="small"
                                  color="error"
                                  disabled={expenseDeletingId === expense.id}
                                  onClick={() => void handleDeleteExpense(expense.id)}
                                  sx={{ minWidth: 0, p: 0.5 }}
                                >
                                  <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                                </Button>
                              </Stack>
                            </Box>

                            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                              <Chip
                                size="small"
                                label={readableCategory(expense.category)}
                                sx={{
                                  bgcolor: `${categoryColor(expense.category)}22`,
                                  color: categoryColor(expense.category),
                                  fontWeight: 700,
                                }}
                              />
                              <Chip size="small" label={expense.paidBy?.username ?? "Unknown"} />
                              <Chip size="small" label={formatMoney(expense.amount)} />
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>

                  <Box
                    sx={{
                      px: 2.2,
                      py: 1.3,
                      borderTop: "1px solid rgba(46,58,86,0.1)",
                      color: "text.secondary",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="body2">
                        Loaded {expenseItems.length}{expenses?.totalItems ? ` of ${expenses.totalItems}` : ""} expenses
                      </Typography>
                      {isLoadingMoreExpenses ? <Typography variant="body2">Loading more...</Typography> : null}
                    </Stack>
                  </Box>

                  <Box ref={expenseLoadMoreRef} sx={{ height: 1, width: "100%" }} />
                </CardContent>
              </Card>

              <Stack spacing={2}>
                <Card sx={{ borderRadius: 1.5, bgcolor: "rgba(232,62,168,0.15)", border: "1px solid rgba(232,62,168,0.2)" }}>
                  <CardContent sx={{ py: 3.2, textAlign: "center" }}>
                    <Typography sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 800, letterSpacing: "0.08em", fontSize: 11 }}>TOTAL SPENT</Typography>
                    <Typography sx={{ mt: 1, fontSize: { xs: 34, md: 46 }, lineHeight: 1, color: "#e83ea8", fontWeight: 900 }}>
                      {Math.round(stats?.totalSpent ?? 0)}
                    </Typography>
                    <Typography sx={{ color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>RON</Typography>
                  </CardContent>
                </Card>

                <Card sx={{ borderRadius: 1.5, bgcolor: "rgba(86,201,239,0.15)", border: "1px solid rgba(86,201,239,0.2)" }}>
                  <CardContent sx={{ py: 3.2, textAlign: "center" }}>
                    <Typography sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 800, letterSpacing: "0.08em", fontSize: 11 }}>MOST EXPENSIVE</Typography>
                    <Typography sx={{ mt: 1.2, color: "#56c9ef", fontSize: { xs: 30, md: 38 }, lineHeight: 1, fontWeight: 900 }}>
                      {readableCategory(stats?.mostExpensiveCategory ?? "other")}
                    </Typography>
                    <Typography sx={{ color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
                      {formatMoney(stats?.topCategoryAmount ?? 0)}
                    </Typography>
                  </CardContent>
                </Card>

                <Card sx={{ borderRadius: 1.5, background: "rgba(255,255,255,0.05)" }}>
                  <CardContent>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Spending by Category
                    </Typography>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2.4}
                      sx={{ mt: 2, alignItems: { xs: "stretch", md: "center" }, justifyContent: "center" }}
                    >
                      <Box
                        sx={{
                          width: { xs: 156, md: 220 },
                          height: { xs: 156, md: 220 },
                          borderRadius: "50%",
                          background: spendingRing,
                          position: "relative",
                          flexShrink: 0,
                          mx: { xs: "auto", md: 0 },
                        }}
                      />
                      <Stack spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
                        {categoryBreakdown.map((item) => (
                          <Typography key={item.category} sx={{ color: categoryColor(item.category), fontWeight: 700 }}>
                            {readableCategory(item.category)} {Math.round(item.percentage)}%
                          </Typography>
                        ))}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Card sx={{ borderRadius: 1.5, background: "rgba(255,255,255,0.05)" }}>
                  <CardContent>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Expenses by Month (Last 6 Months)
                    </Typography>
                    <Box sx={{ overflowX: "auto", pb: 0.6, mt: 2.2 }}>
                      <Stack
                        direction="row"
                        spacing={1.2}
                        sx={{ alignItems: "flex-end", minWidth: monthlyBreakdown.length * 72 }}
                      >
                        {monthlyBreakdown.map((month) => {
                          const barH = Math.max(6, (month.amount / highestMonthlyAmount) * 120);
                          return (
                            <Box key={month.month} sx={{ flex: "0 0 64px", display: "flex", flexDirection: "column", alignItems: "center", gap: 0.4 }}>
                              <Typography variant="caption" sx={{ fontSize: 10, color: "#56c9ef", fontWeight: 800, whiteSpace: "nowrap", minHeight: 14 }}>
                                {month.amount > 0 ? formatMoney(month.amount) : ""}
                              </Typography>
                              <Box sx={{ width: "70%", height: barH, background: "linear-gradient(180deg, #56c9ef, #6f29c6)", borderRadius: "4px 4px 0 0", transition: "height 220ms ease" }} />
                              <Typography sx={{ textAlign: "center", fontWeight: 700, fontSize: 12 }}>{month.month}</Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>
              </Stack>
            </Box>
          )}

          {tabValue === "settlements" && (
            <Stack spacing={3}>
              {paySuccess && (
                <Typography sx={{ color: "#34d399", fontWeight: 700, bgcolor: "rgba(52,211,153,0.1)", px: 2, py: 1.2, borderRadius: 2 }}>
                  ✓ {paySuccess}
                </Typography>
              )}
              {payError && (
                <Typography sx={{ color: "#cf2e2e", fontWeight: 700 }}>{payError}</Typography>
              )}

              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" } }}>
                <Card sx={{ borderRadius: 1.5, bgcolor: "rgba(232,62,168,0.15)", border: "1px solid rgba(232,62,168,0.2)" }}>
                  <CardContent sx={{ textAlign: "center", py: 3 }}>
                    <Typography sx={{ color: "#9b9b9b", fontWeight: 800, letterSpacing: "0.08em", fontSize: 12 }}>YOU OWE</Typography>
                    <Typography sx={{ mt: 1, fontSize: 36, fontWeight: 900, color: "#e74c3c", lineHeight: 1 }}>
                      {formatMoney(balances?.totalYouOwe ?? 0)}
                    </Typography>
                  </CardContent>
                </Card>
                <Card sx={{ borderRadius: 1.5, bgcolor: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <CardContent sx={{ textAlign: "center", py: 3 }}>
                    <Typography sx={{ color: "#9b9b9b", fontWeight: 800, letterSpacing: "0.08em", fontSize: 12 }}>OWED TO YOU</Typography>
                    <Typography sx={{ mt: 1, fontSize: 36, fontWeight: 900, color: "#27ae60", lineHeight: 1 }}>
                      {formatMoney(balances?.totalOwedToYou ?? 0)}
                    </Typography>
                  </CardContent>
                </Card>
                <Card sx={{ borderRadius: 1.5, bgcolor: "rgba(86,201,239,0.15)", border: "1px solid rgba(86,201,239,0.2)" }}>
                  <CardContent sx={{ textAlign: "center", py: 3 }}>
                    <Typography sx={{ color: "#9b9b9b", fontWeight: 800, letterSpacing: "0.08em", fontSize: 12 }}>NET</Typography>
                    <Typography sx={{ mt: 1, fontSize: 36, fontWeight: 900, color: (balances?.net ?? 0) >= 0 ? "#27ae60" : "#e74c3c", lineHeight: 1 }}>
                      {formatMoney(balances?.net ?? 0)}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {(balances?.youOweTo?.length ?? 0) > 0 && (
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.5 }}>You owe</Typography>
                  <Stack spacing={1.5}>
                    {balances!.youOweTo.map((b) => (
                      <Card key={b.userId} sx={{ borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(248,113,113,0.3)" }}>
                        <CardContent sx={{ p: 2.2 }}>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: 20 }}>{b.username}</Typography>
                              <Typography sx={{ color: "text.secondary", fontSize: 14 }}>{b.email}</Typography>
                              <Typography sx={{ fontWeight: 900, fontSize: 22, color: "#e74c3c", mt: 0.5 }}>
                                {formatMoney(Math.abs(b.amount))}
                              </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                              {b.stripeAccountId && myStripeAccountId && (
                                <Button
                                  variant="contained"
                                  disabled={stripePayingId === b.userId}
                                  onClick={() => void handleStripePayment(Number(b.userId), Math.abs(b.amount))}
                                  sx={{
                                    borderRadius: 999,
                                    fontWeight: 800,
                                    textTransform: "none",
                                    bgcolor: "#635bff",
                                    "&:hover": { bgcolor: "#4f49cc" },
                                  }}
                                >
                                  {stripePayingId === b.userId ? "Paying..." : "Pay with Stripe"}
                                </Button>
                              )}
                              <Button
                                variant="outlined"
                                disabled={stripePayingId === b.userId}
                                onClick={() => void handleManualPayment(Number(b.userId), Math.abs(b.amount))}
                                sx={{ borderRadius: 999, fontWeight: 800, textTransform: "none" }}
                              >
                                Mark as paid
                              </Button>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              )}

              {(balances?.othersOweToYou?.length ?? 0) > 0 && (
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.5 }}>Owed to you</Typography>
                  <Stack spacing={1.5}>
                    {balances!.othersOweToYou.map((b) => (
                      <Card key={b.userId} sx={{ borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(52,211,153,0.3)" }}>
                        <CardContent sx={{ p: 2.2 }}>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: 20 }}>{b.username}</Typography>
                              <Typography sx={{ color: "text.secondary", fontSize: 14 }}>{b.email}</Typography>
                              <Typography sx={{ fontWeight: 900, fontSize: 22, color: "#27ae60", mt: 0.5 }}>
                                {formatMoney(Math.abs(b.amount))}
                              </Typography>
                            </Box>
                            <Button
                              variant="outlined"
                              size="small"
                              disabled={requestingId === b.userId}
                              onClick={() => void handlePaymentRequest(Number(b.userId), Math.abs(b.amount))}
                              sx={{ borderRadius: 999, fontWeight: 800, textTransform: "none", borderColor: "#27ae60", color: "#27ae60", "&:hover": { borderColor: "#219a52", bgcolor: "rgba(39,174,96,0.06)" } }}
                            >
                              {requestingId === b.userId ? "Requesting..." : "Request payment"}
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              )}

              {balances?.totalYouOwe === 0 && balances?.totalOwedToYou === 0 && (
                <Card sx={{ borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <CardContent sx={{ textAlign: "center", py: 4 }}>
                    <Typography sx={{ fontSize: 48 }}>🎉</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 22, mt: 1 }}>All settled up!</Typography>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}

          {tabValue === "members" && (
            <Stack spacing={2}>
              <Card sx={{ borderRadius: 1.5, background: "rgba(255,255,255,0.05)" }}>
                <CardContent sx={{ p: 2.4 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
                    Add Member
                  </Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
                    <TextField
                      value={newMemberIdentifier}
                      onChange={(event) => setNewMemberIdentifier(event.target.value)}
                      placeholder="Email or Username"
                      fullWidth
                    />
                    <Button
                      variant="contained"
                      onClick={() => void handleMemberAdd()}
                      disabled={memberBusy || newMemberIdentifier.trim().length === 0}
                      sx={{
                        minWidth: 92,
                        bgcolor: "rgba(232,62,168,0.3)",
                        fontWeight: 800,
                        textTransform: "none",
                      }}
                    >
                      Add
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
                {(group?.members ?? []).filter(Boolean).map((member) => {
                  if (!member) {
                    return null;
                  }

                  const isAdmin = group?.adminIds.includes(member.id) ?? false;
                  const canDelete = isAppAdmin ? true : Boolean(canManageGroup && !isAdmin);

                  return (
                    <Card key={member.id} sx={{ borderRadius: 1.5, background: "rgba(255,255,255,0.05)" }}>
                      <CardContent sx={{ p: 2.4 }}>
                        <Stack direction="row" spacing={1.2} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
                              <Typography sx={{ fontWeight: 800, fontSize: { xs: 22, md: 30 }, lineHeight: 1 }}>{member.username}</Typography>
                              {isAdmin && <Chip label="Admin" sx={{ bgcolor: "rgba(86,201,239,0.15)", color: "#56c9ef", fontWeight: 800 }} />}
                            </Stack>
                            <Typography sx={{ mt: 0.8, color: "text.secondary", fontSize: { xs: 15, md: 22 } }}>{member.email}</Typography>
                          </Box>
                          {canDelete ? (
                            <Button
                              variant="text"
                              color="error"
                              disabled={memberBusy}
                              onClick={() => void handleMemberRemove(member.id)}
                              sx={{ minWidth: 0, p: 0.4 }}
                            >
                              <DeleteOutlineRoundedIcon />
                            </Button>
                          ) : null}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>

              <Stack direction="row" spacing={1.2} sx={{ pt: 1, justifyContent: "flex-end" }}>
                {!isAppAdmin && (
                  <Button color="error" variant="outlined" onClick={() => void handleLeaveGroup()} disabled={groupActionBusy}>
                    Leave Group
                  </Button>
                )}
                <Button
                  color="error"
                  variant="outlined"
                  onClick={() => void handleDeleteGroup()}
                  disabled={groupActionBusy || !canManageGroup}
                  sx={{ opacity: canManageGroup ? 1 : 0.5 }}
                >
                  Delete Group
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

function readableCategory(category: string) {
  if (category === "food") return "Food & Dining";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function categoryColor(category: string) {
  if (category === "groceries") return "#56a069";
  if (category === "transport") return "#0f8f93";
  if (category === "utilities") return "#2f78c9";
  if (category === "entertainment") return "#d7568f";
  if (category === "food") return "#f07a2b";
  if (category === "rent") return "#638fc6";
  return "#8c96a4";
}

function touchesCurrentGroup(message: unknown, groupId: number) {
  try {
    const parsed = (typeof message === "string" ? JSON.parse(message) : message) as { type?: string; data?: unknown };
    const data = parsed?.data;
    if (typeof data !== "object" || data === null) {
      return true;
    }

    if ("groupId" in data && typeof (data as { groupId?: unknown }).groupId === "number") {
      return (data as { groupId: number }).groupId === groupId;
    }

    if ("id" in data && parsed.type?.startsWith("group.")) {
      return typeof (data as { id?: unknown }).id !== "number" || (data as { id: number }).id === groupId;
    }

    return true;
  } catch {
    return true;
  }
}
