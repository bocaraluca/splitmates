"use client";

import { useEffect, useState, use } from "react";
import { Box, Button, Typography, Paper } from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import { useRouter } from "next/navigation";
import { fetchFromBackend } from "../../../../lib/backend-api";
import { ChatPanel } from "../../../../components/chat/chat-panel";

export default function Page({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId: groupIdStr } = use(params);
  const groupId = Number(groupIdStr ?? "0");
  const router = useRouter();
  const [groupName, setGroupName] = useState<string>(`Group ${groupId}`);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const payload = await fetchFromBackend<{ group: { id: number; name: string } }>(`/groups/${groupId}`);
        if (mounted && payload?.group?.name) {
          setGroupName(payload.group.name);
        }
      } catch {
      }
    })();
    return () => {
      mounted = false;
    };
  }, [groupId]);

  return (
    <Box 
      sx={{ 
        height: "100dvh", 
        width: "100%", 
        display: "flex", 
        flexDirection: "column",
        background: "linear-gradient(104deg, #f9e6ff 0%, #f0dcff 40%, #ddf5ff 100%)", 
        overflow: "hidden" 
      }}
    >
      <Paper 
        elevation={0}
        sx={{ 
          display: "flex", 
          alignItems: "center", 
          gap: { xs: 1, md: 2 }, 
          px: { xs: 1.5, md: 4 }, 
          py: 2,
          background: "linear-gradient(90deg, #5b36c8 0%, #d841aa 54%, #52c7ea 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.22)", 
          borderRadius: 0,
          zIndex: 10
        }}
      >
        <Button 
          startIcon={<ArrowBackIosNewRoundedIcon sx={{ fontSize: "1.1rem" }} />} 
          onClick={() => router.push(`/groups/${groupId}`)}
          sx={{ 
            textTransform: "none", 
            fontWeight: 800,
            color: "#ffffff", 
            borderRadius: "20px",
            px: 2,
            "&:hover": { bgcolor: "rgba(255, 255, 255, 0.15)" } 
          }}
        >
          Back
        </Button>
        
        <Typography 
          variant="h6" 
          component="h1"
          sx={{ 
            fontWeight: 900, 
            lineHeight: 2, 
            letterSpacing: "-0.02em",
            ml: 3,
            color: "#ffffff" 
          }}
        >
          <Box component="span" sx={{ fontWeight: 800 }}>
            {groupName}
          </Box>
        </Typography>
      </Paper>

      <Box 
        sx={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column",
          minHeight: 0,
          position: "relative",
          width: "100%",
        }}
      >
        <ChatPanel groupId={groupId} groupName={groupName} fullPage />
      </Box>
    </Box>
  );
}