"use client";

import { useState } from "react";
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

export function CreateGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<GroupCategory>("friends");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [token] = useState<string | null>(getToken);

  async function handleCreateGroup() {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setErrorMessage("Group name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetchFromBackend<{ group: GroupSummary }>("/groups", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          name: normalizedName,
          description: description.trim() || undefined,
          category,
        }),
      });

      router.push(`/groups/${response.group.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create group.");
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
      <Button component={Link} href="/groups" sx={{ position: "absolute", top: 24, left: 24, color: "white", fontWeight: 700, zIndex: 10, fontSize: 18 }}>
        ← Back to Groups
      </Button>
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 }, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", position: "relative", zIndex: 1 }}>
        <Stack sx={{ width: "100%" }}>
          <Card sx={{ borderRadius: 3, background: "rgba(10,5,30,0.72)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
            <CardContent sx={{ p: { xs: 4, md: 6 } }}>
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1.02 }}>
                Create Group
              </Typography>
              <Typography sx={{ mt: 1, color: "text.secondary" }}>
                Start a new shared group and invite members after creating it.
              </Typography>

              <Stack spacing={1.3} sx={{ mt: 2.4 }}>
                <TextField label="Group name" value={name} onChange={(event) => setName(event.target.value)} />
                <TextField
                  label="Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  multiline
                  minRows={3}
                />
                <FormControl>
                  <InputLabel id="create-group-category-label">Category</InputLabel>
                  <Select
                    labelId="create-group-category-label"
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
                    onClick={() => void handleCreateGroup()}
                    disabled={submitting || name.trim().length === 0}
                    sx={{ borderRadius: 1, textTransform: "none", fontWeight: 800, px: 2.4 }}
                  >
                    {submitting ? "Creating..." : "Create group"}
                  </Button>
                  <Button component={Link} href="/groups" variant="outlined" sx={{ borderRadius: 1, textTransform: "none", fontWeight: 700 }}>
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
