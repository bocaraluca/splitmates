"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Card, CardContent, Container, MenuItem, Stack, TextField, Typography } from "@mui/material";
import {
  addExpenseToOfflineCache,
  fetchFromBackend,
  markExpenseDeleted,
  updateExpenseInOfflineCache,
} from "@/lib/backend-api";
import { getToken } from "@/lib/auth-storage";
import { parseExpenseForm } from "@/lib/validators";
import { EXPENSE_CATEGORIES, SPLIT_TYPES } from "@/lib/types";
import type { ExpenseDetail, ExpenseListItem, GroupSummary, User } from "@/lib/types";

function buildCachedExpenseListItem(
  raw: Record<string, unknown> | null | undefined,
  paidBy: User | null,
): ExpenseListItem | null {
  if (!raw) {
    return null;
  }

  const id = Number(raw.id);
  if (!Number.isFinite(id)) {
    return null;
  }

  const amount = Number(raw.amount ?? 0);
  return {
    id,
    title: String(raw.title ?? ""),
    amount: Number.isFinite(amount) ? amount : 0,
    currency: "RON",
    date: String(raw.date ?? new Date().toISOString()),
    paidBy,
    category: (raw.category as ExpenseListItem["category"]) ?? "other",
    splitType: (raw.splitType as ExpenseListItem["splitType"]) ?? "equal",
  };
}

export function EditExpensePage({ groupId, expenseId }: { groupId: number; expenseId?: number }) {
  const router = useRouter();
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [expenseDetail, setExpenseDetail] = useState<ExpenseDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const [splitTypeOverride, setSplitTypeOverride] = useState<string | null>(null);
  const [paidByUserIdOverride, setPaidByUserIdOverride] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState<string>("");
  const [amountDraft, setAmountDraft] = useState<string>("");
  const [customSharesByUserId, setCustomSharesByUserId] = useState<Record<number, string>>({});
  const [token] = useState<string | null>(getToken);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const auth = token ? { token } : {};
    void fetchFromBackend<{ group: GroupSummary }>(`/groups/${groupId}`, auth)
      .then((response) => setGroup(response.group))
      .catch(() => setGroup(null));

    if (expenseId) {
      void fetchFromBackend<ExpenseDetail>(`/groups/${groupId}/expenses/${expenseId}`, auth)
        .then((detail) => setExpenseDetail(detail))
        .catch(() => setExpenseDetail(null));
    }
  }, [expenseId, groupId, token]);

  const selectedMembers = useMemo(() => group?.members.filter(Boolean) ?? [], [group]);
  const pageMode = expenseId ? "edit" : "new";
  const currentExpense = expenseDetail?.expense;
  const categoryValue = categoryOverride ?? currentExpense?.category ?? "food";
  const splitTypeValue = splitTypeOverride ?? currentExpense?.splitType ?? "equal";
  const paidByUserIdValue = paidByUserIdOverride ?? String(currentExpense?.paidByUserId ?? selectedMembers[0]?.id ?? "");

  useEffect(() => {
    if (currentExpense?.title != null) {
      Promise.resolve().then(() => setTitleDraft(currentExpense.title));
    }
  }, [currentExpense?.title]);

  useEffect(() => {
    if (currentExpense?.amount != null) {
      Promise.resolve().then(() => setAmountDraft(String(currentExpense.amount)));
    }
  }, [currentExpense?.amount]);

  useEffect(() => {
    const existingShares = new Map<number, number>((currentExpense?.shares ?? []).map((share) => [share.userId, share.amount]));
    Promise.resolve().then(() => {
      setCustomSharesByUserId((prev) => {
        const nextState: Record<number, string> = {};
        selectedMembers.forEach((member) => {
          const memberId = Number(member?.id ?? 0);
          if (memberId > 0) {
            const previousValue = prev[memberId];
            if (previousValue != null && previousValue !== "") {
              nextState[memberId] = previousValue;
              return;
            }
            const existingValue = existingShares.get(memberId);
            nextState[memberId] = existingValue != null ? String(existingValue) : "";
          }
        });
        return nextState;
      });
    });
  }, [selectedMembers, currentExpense?.id, currentExpense?.shares]);

  const customShareTotal = useMemo(
    () =>
      selectedMembers.reduce((sum, member) => {
        const memberId = Number(member?.id ?? 0);
        const shareValue = Number(customSharesByUserId[memberId] ?? "");
        return Number.isFinite(shareValue) ? sum + shareValue : sum;
      }, 0),
    [customSharesByUserId, selectedMembers],
  );

  const amountNumeric = Number(amountDraft);
  const customSharesMatchAmount = Number.isFinite(amountNumeric) && amountNumeric > 0 && Math.abs(customShareTotal - amountNumeric) < 0.01;

  async function handleSubmit(event: import("react").FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const memberIds = selectedMembers.map((member) => Number(member?.id ?? 0)).filter((id) => Number.isInteger(id) && id > 0);
      if (!memberIds.length) {
        throw new Error("Add at least one member before creating an expense.");
      }

      formData.set("memberIds", memberIds.join(","));

      if (splitTypeValue === "custom") {
        const customShares = memberIds.map((memberId) => {
          const rawValue = String(customSharesByUserId[memberId] ?? "").trim();
          const parsedValue = Number(rawValue);
          if (rawValue === "" || !Number.isFinite(parsedValue) || parsedValue < 0) {
            throw new Error("Enter a valid custom share for each member.");
          }
          return { userId: memberId, amount: parsedValue };
        });

        const sharesTotal = customShares.reduce((sum, share) => sum + share.amount, 0);
        const amountValue = Number(formData.get("amount"));
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
          throw new Error("Amount must be a positive number.");
        }
        if (Math.abs(sharesTotal - amountValue) >= 0.01) {
          throw new Error("Custom shares must add up exactly to the expense amount.");
        }

        formData.set(
          "shares",
          customShares
            .map((share) => `${share.userId}:${share.amount}`)
            .join("\n"),
        );
      } else {
        formData.set("shares", "");
      }

      const payload = parseExpenseForm(formData);
      const paidByMember = group?.members.find((member) => Number(member?.id ?? 0) === payload.paidByUserId) ?? null;

      if (!expenseId) {
        const created = await fetchFromBackend<{ expense: Record<string, unknown> }>(`/groups/${groupId}/expenses`, {
          method: "POST",
          token: token ?? undefined,
          body: JSON.stringify(payload),
        });
        const cachedItem = buildCachedExpenseListItem(created?.expense ?? payload, paidByMember);
        if (cachedItem) {
          addExpenseToOfflineCache(groupId, cachedItem as unknown as Record<string, unknown>);
        }
      } else {
        const updated = await fetchFromBackend<{ expense: Record<string, unknown> }>(`/groups/${groupId}/expenses/${expenseId}`, {
          method: "PATCH",
          token: token ?? undefined,
          body: JSON.stringify(payload),
        });
        const cachedItem = buildCachedExpenseListItem({ id: expenseId, ...(updated?.expense ?? payload) }, paidByMember);
        if (cachedItem) {
          updateExpenseInOfflineCache(groupId, cachedItem as unknown as Record<string, unknown>);
        }
      }

      router.push(`/groups/${groupId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save expense.");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this expense? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    if (expenseId) {
      markExpenseDeleted(groupId, expenseId);
    }
    try {
      await fetchFromBackend(`/groups/${groupId}/expenses/${expenseId}`, {
        method: "DELETE",
        token: token ?? undefined,
      });
      router.push(`/groups/${groupId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete expense.");
      setIsDeleting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: "url(/assets/background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        position: "relative",
        overflowX: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundColor: { xs: "rgba(19, 12, 34, 0.18)", md: "transparent" },
          backdropFilter: { xs: "blur(7px)", md: "none" },
          WebkitBackdropFilter: { xs: "blur(7px)", md: "none" },
          pointerEvents: "none",
          zIndex: 0,
        },
      }}
    >
      <Button component={Link} href={`/groups/${groupId}`} sx={{ position: "absolute", top: 24, left: 24, color: "white", fontWeight: 700, zIndex: 10, fontSize: 18 }}>
        ← Back to Group
      </Button>
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 }, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", position: "relative", zIndex: 1 }}>
        <Stack sx={{ width: "100%" }}>
          <Card sx={{ borderRadius: 2, background: "rgba(255,255,255,0.96)", border: "1px solid rgba(148, 71, 198, 0.16)", boxShadow: "0 16px 36px rgba(121, 72, 180, 0.12)" }}>
            <CardContent sx={{ p: { xs: 4, md: 6 } }}>
              <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 44 }, fontWeight: 800, lineHeight: 1.05 }}>
                {pageMode === "edit" ? "Edit expense" : "Add expense"}
              </Typography>

              <Box component="form" onSubmit={handleSubmit} sx={{ display: "grid", gap: 2.2 }}>
                <TextField
                  name="title"
                  label="Title"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  name="amount"
                  label="Amount"
                  type="number"
                  value={amountDraft}
                  onChange={(event) => setAmountDraft(event.target.value)}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  name="date"
                  label="Date"
                  type="date"
                  defaultValue={currentExpense?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  name="category"
                  label="Category"
                  select
                  value={categoryValue}
                  onChange={(event) => setCategoryOverride(event.target.value)}
                  fullWidth
                >
                  {EXPENSE_CATEGORIES.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  name="splitType"
                  label="Split type"
                  select
                  value={splitTypeValue}
                  onChange={(event) => setSplitTypeOverride(event.target.value)}
                  fullWidth
                >
                  {SPLIT_TYPES.map((splitType) => (
                    <MenuItem key={splitType} value={splitType}>
                      {splitType}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  name="paidByUserId"
                  label="Paid by"
                  select
                  value={paidByUserIdValue}
                  onChange={(event) => setPaidByUserIdOverride(event.target.value)}
                  fullWidth
                >
                  {selectedMembers.map((member) => (
                    <MenuItem key={member?.id} value={member?.id}>
                      {member?.username}
                    </MenuItem>
                  ))}
                </TextField>

                {splitTypeValue === "custom" && (
                  <Box sx={{ p: 2, borderRadius: 1.5, border: "1px solid rgba(148, 71, 198, 0.2)", background: "rgba(250, 243, 255, 0.78)" }}>
                    <Typography sx={{ fontWeight: 800, mb: 1.4, color: "#4a3673" }}>Custom shares by member</Typography>
                    <Stack spacing={1.4}>
                      {selectedMembers.map((member) => {
                        const memberId = Number(member?.id ?? 0);
                        return (
                          <TextField
                            key={memberId}
                            label={`${member?.username ?? "Member"} share`}
                            type="number"
                            value={customSharesByUserId[memberId] ?? ""}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setCustomSharesByUserId((previous) => ({ ...previous, [memberId]: nextValue }));
                            }}
                            fullWidth
                            slotProps={{ inputLabel: { shrink: true } }}
                          />
                        );
                      })}
                    </Stack>
                    <Typography sx={{ mt: 1.3, fontWeight: 700, color: customSharesMatchAmount ? "#2f6f4e" : "#b42352" }}>
                      Total shares: {Number.isFinite(customShareTotal) ? customShareTotal.toFixed(2) : "0.00"} / {Number.isFinite(amountNumeric) ? amountNumeric.toFixed(2) : "0.00"}
                    </Typography>
                    {!customSharesMatchAmount && (
                      <Typography sx={{ mt: 0.4, fontSize: 13, color: "#b42352" }}>
                        The total custom shares must match the Amount exactly to save.
                      </Typography>
                    )}
                  </Box>
                )}

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mt: 0.6 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    sx={{ py: 1.2, flex: { xs: 1, sm: "auto" } }}
                    disabled={splitTypeValue === "custom" && !customSharesMatchAmount}
                  >
                    {pageMode === "edit" ? "Save" : "Create"}
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    sx={{ py: 1.2, flex: { xs: 1, sm: "auto" } }}
                    onClick={() => router.push(`/groups/${groupId}`)}
                  >
                    Cancel
                  </Button>
                  {pageMode === "edit" && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="large"
                      sx={{ py: 1.2, flex: { xs: 1, sm: "auto" } }}
                      disabled={isDeleting}
                      onClick={() => void handleDelete()}
                    >
                      Delete
                    </Button>
                  )}
                </Stack>
              </Box>

              {errorMessage && (
                <Typography variant="body2" sx={{ mt: 2, color: "primary.main", fontWeight: 700 }}>
                  {errorMessage}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
