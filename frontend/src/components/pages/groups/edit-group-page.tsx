"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, Card, CardContent, Container, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { fetchFromBackend } from "@/lib/backend-api";
import { getToken } from "@/lib/auth-storage";
import { GROUP_CATEGORIES } from "@/lib/types";
import type { GroupCategory, GroupSummary } from "@/lib/types";

function capitalizeFirstLetter(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function EditGroupPage({ groupId }: { groupId: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<GroupCategory>("friends");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [token] = useState<string | null>(getToken);

  useEffect(() => {
    void fetchFromBackend<{ group: GroupSummary }>(`/groups/${groupId}`, token ? { token } : {})
      .then((response) => {
        setName(response.group.name);
        setDescription(response.group.description ?? "");
        setCategory(response.group.category);
        setErrorMessage(null);
      })
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : "Unable to load group."))
      .finally(() => setLoading(false));
  }, [groupId, token]);

  async function handleSave() {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setErrorMessage("Group name is required.");
      return;
    }

    setSubmitting(true);
    try {
      await fetchFromBackend(`/groups/${groupId}`, {
        method: "PATCH",
        token: token ?? undefined,
        body: JSON.stringify({
          name: normalizedName,
          description: description.trim() || undefined,
          category,
        }),
      });

      router.push(`/groups/${groupId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update group.");
    } finally {
      setSubmitting(false);
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
      <Button component={Link} href={`/groups/${groupId}`} sx={{ position: "absolute", top: 24, left: 24, zIndex: 10, color: "white", fontWeight: 900, fontSize: 22, minWidth: 0, px: 2.2, py: 0.7, backgroundColor: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.22)", backdropFilter: "blur(10px)", borderRadius: 999, "&:hover": { backgroundColor: "rgba(255,255,255,0.24)" } }}>
        ←
      </Button>
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 }, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", position: "relative", zIndex: 1 }}>
        <Stack sx={{ width: "100%" }}>
          <Card sx={{ borderRadius: 3, background: "rgba(10,5,30,0.72)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
            <CardContent sx={{ p: { xs: 4, md: 6 } }}>
              <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 44 }, fontWeight: 800, lineHeight: 1.05 }}>
                Edit group
              </Typography>
              <Typography variant="body1" sx={{ mt: 1, color: "text.secondary" }}>
                Update group details and save changes.
              </Typography>

              <Stack spacing={1.3} sx={{ mt: 3.2 }}>
                <TextField label="Group name" value={name} onChange={(event) => setName(event.target.value)} fullWidth />
                <TextField
                  label="Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel id="edit-group-category-label">Category</InputLabel>
                  <Select
                    labelId="edit-group-category-label"
                    value={category}
                    label="Category"
                    onChange={(event) => setCategory(event.target.value as GroupCategory)}
                  >
                    {GROUP_CATEGORIES.map((option) => (
                      <MenuItem key={option} value={option}>
                        {capitalizeFirstLetter(option)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {errorMessage ? <Typography sx={{ color: "#c43e57", fontWeight: 700 }}>{errorMessage}</Typography> : null}

                <Stack direction="row" spacing={1.2}>
                  <Button
                    variant="contained"
                    onClick={() => void handleSave()}
                    disabled={loading || submitting || name.trim().length === 0}
                    sx={{ borderRadius: 1, textTransform: "none", fontWeight: 800, px: 2.4 }}
                  >
                    {submitting ? "Saving..." : "Save changes"}
                  </Button>
                  <Button component={Link} href={`/groups/${groupId}`} variant="outlined" sx={{ borderRadius: 1, textTransform: "none", fontWeight: 700 }}>
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
