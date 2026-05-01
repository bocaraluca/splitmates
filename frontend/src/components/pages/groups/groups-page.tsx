"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { Box, Button, Card, CardContent, Chip, Container, Stack, TextField, Typography } from "@mui/material";
import { AppNavbar } from "@/components/navigation/app-navbar";
import { fetchFromBackend } from "@/lib/backend-api";
import { getToken } from "@/lib/auth-storage";
import type { GroupSummary } from "@/lib/types";

function CreateGroupButton({ display, sizeXs, sizeMd, alignSelf }: {
  display: { xs: string; sm: string };
  sizeXs: number;
  sizeMd?: number;
  alignSelf?: "auto" | "center";
}) {
  const size = sizeMd != null ? { xs: sizeXs, md: sizeMd } : sizeXs;
  const iconSize = sizeMd != null ? { xs: 28, md: 34 } : 28;

  return (
    <Button
      component={Link}
      href="/groups/new"
      aria-label="Create group"
      sx={{
        display,
        ...(alignSelf ? { alignSelf: { xs: "center", sm: alignSelf } } : {}),
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #5ec9eb, #6f29c6)",
        color: "white",
        boxShadow: "0 14px 28px rgba(111, 41, 198, 0.34)",
        border: "2px solid rgba(255,255,255,0.55)",
        animation: "floatActionButton 4.4s ease-in-out infinite",
        transformOrigin: "center",
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
      }}
    >
      <AddRoundedIcon sx={{ fontSize: iconSize }} />
    </Button>
  );
}

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [token] = useState<string | null>(getToken);

  const loadGroups = useCallback(() => {
    const auth = token ? { token } : {};
    void fetchFromBackend<{ groups: GroupSummary[] }>("/groups", auth)
      .then((response) => {
        setGroups(response.groups.filter((group) => group.isMember));
        setErrorMessage(null);
      })
      .catch((error) => {
        setGroups([]);
        setErrorMessage(error instanceof Error ? error.message : "Unable to load your groups.");
      });
  }, [token]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    const handleBackendUpdate = () => {
      void loadGroups();
    };

    window.addEventListener("splitmates:backend-update", handleBackendUpdate);
    return () => window.removeEventListener("splitmates:backend-update", handleBackendUpdate);
  }, [loadGroups]);

  const filteredGroups = useMemo(() => {
    const searchText = query.trim().toLowerCase();
    return searchText
      ? groups.filter((group) => [group.name, group.category, ...group.members.map((member) => member?.username ?? "")].join(" ").toLowerCase().includes(searchText))
      : groups;
  }, [groups, query]);

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(108deg, rgba(248,233,255,0.95) 0%, rgba(239,227,255,0.94) 50%, rgba(227,246,255,0.94) 100%)", overflowX: "clip" }}>
      <AppNavbar />
      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 }, px: { xs: 1.5, sm: 2, md: 4 } }}>
        <Stack spacing={3}>
          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "center", sm: "center" }, gap: 2, flexWrap: "wrap" }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h2" sx={{ fontSize: { xs: 38, md: 54 }, fontWeight: 800, lineHeight: 1, textAlign: { xs: "center", sm: "left" } }}>
                Groups
              </Typography>
            </Box>

            <CreateGroupButton
              display={{ xs: "none", sm: "inline-flex" }}
              sizeXs={56}
              sizeMd={72}
              alignSelf="auto"
            />
          </Box>

          <TextField value={query} onChange={(event) => setQuery(event.target.value)} label="Search groups" fullWidth />

          <Box sx={{ display: { xs: "flex", sm: "none" }, justifyContent: "center" }}>
            <CreateGroupButton display={{ xs: "inline-flex", sm: "none" }} sizeXs={56} />
          </Box>

          {errorMessage ? <Typography sx={{ color: "#c43e57", fontWeight: 700 }}>{errorMessage}</Typography> : null}

          <Box sx={{ display: "grid", gap: { xs: 1.5, md: 2 }, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, width: "100%", justifyItems: "stretch" }}>
            {filteredGroups.map((group) => (
              <Card
                key={group.id}
                sx={{
                  minHeight: 260,
                  borderRadius: { xs: 2, md: 0 },
                  background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(252,246,255,0.9))",
                  border: "1px solid rgba(148, 71, 198, 0.16)",
                  boxShadow: "0 10px 24px rgba(121, 72, 180, 0.1)",
                  position: "relative",
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: 4,
                    background: "linear-gradient(90deg, #e83ea8, #6f29c6, #56c9ef)",
                  },
                }}
              >
                <CardContent sx={{ p: { xs: 1.75, md: 3 }, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
                  <Box>
                    <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap" }}>
                      <Chip label={group.category} color="primary" variant="outlined" />
                      <Chip label={`${group.members.filter(Boolean).length} members`} />
                    </Stack>
                    <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, fontSize: { xs: 26, md: 34 }, overflowWrap: "anywhere" }}>
                      {group.name}
                    </Typography>
                    {group.description ? (
                      <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary", lineHeight: 1.8, overflowWrap: "anywhere" }}>
                        {group.description}
                      </Typography>
                    ) : null}
                    <Stack direction="row" spacing={0.8} sx={{ mt: 2, flexWrap: "wrap" }}>
                      {group.members.filter(Boolean).map((member) => (
                        <Chip key={member?.id ?? member?.username} label={member?.username ?? "unknown"} size="small" />
                      ))}
                    </Stack>
                  </Box>
                  <Button component={Link} href={`/groups/${group.id}`} variant="text" sx={{ justifyContent: "flex-start", px: 0, fontWeight: 800 }}>
                    View group →
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
