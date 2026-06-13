"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { LandingNavbar } from "@/components/navigation/landing-navbar";

const INTRO_DURATION_MS = 2200;
const INTRO_LOGO_FRAME_SIZE = { xs: 152, sm: 184, md: 210 };

const featureCards = [
  {
    title: "Make a group",
    text: "for your roommates or friends",
    color: "linear-gradient(135deg, #f06bae, #a149d8)",
    icon: <GroupRoundedIcon fontSize="small" />,
  },
  {
    title: "Easy splitting",
    text: "for food, trips, and bills",
    color: "linear-gradient(135deg, #5ec9eb, #6f72ff)",
    icon: <AccountBalanceWalletRoundedIcon fontSize="small" />,
  },
  {
    title: "Turn bad spending",
    text: "into  financial awareness",
    color: "linear-gradient(135deg, #ff7dbf, #f04f9e)",
    icon: <BarChartRoundedIcon fontSize="small" />,
  },
];

const floatingBubbles = [
  {
    label: "Easy splitting",
    color: "#e83ea8",
    bg: "linear-gradient(135deg, rgba(232,62,168,0.45), rgba(139,92,246,0.45))",
    shadow: "0 14px 34px rgba(232,62,168,0.25)",
    sx: {
      top: { xs: 20, md: 8 },
      left: { xs: 16, md: -18 },
      animation: "floatBubbleOne 6.4s ease-in-out infinite",
    },
  },
  {
    label: "Financial education",
    color: "#56c9ef",
    bg: "linear-gradient(135deg, rgba(86,201,239,0.45), rgba(111,41,198,0.45))",
    shadow: "0 14px 34px rgba(86,201,239,0.2)",
    sx: {
      top: { xs: 52, md: 32 },
      right: { xs: 14, md: -20 },
      animation: "floatBubbleTwo 7.2s ease-in-out infinite",
    },
  },
  {
    label: "No stress over money",
    color: "#34d399",
    bg: "linear-gradient(135deg, rgba(52,211,153,0.45), rgba(86,201,239,0.45))",
    shadow: "0 14px 34px rgba(52,211,153,0.2)",
    sx: {
      bottom: { xs: 26, md: -6 },
      left: { xs: "50%", md: 120 },
      animation: "floatBubbleThree 6.8s ease-in-out infinite",
    },
  },
];

function IntroSplash() {
  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 2400,
        overflow: "hidden",
        "@keyframes introLogoSpin": {
          "0%": { transform: "rotate(0deg) scale(0.95)", opacity: 1 },
          "100%": { transform: "rotate(360deg) scale(1)", opacity: 1 },
        },
        "@keyframes introLogoFade": {
          "0%": { opacity: 1 },
          "100%": { opacity: 0 },
        },
        "@keyframes introSplitLeft": {
          "0%": { transform: "translateX(0)", opacity: 0 },
          "1%": { opacity: 1 },
          "100%": { transform: "translateX(-102%)", opacity: 1 },
        },
        "@keyframes introSplitRight": {
          "0%": { transform: "translateX(0)", opacity: 0 },
          "1%": { opacity: 1 },
          "100%": { transform: "translateX(102%)", opacity: 1 },
        },
        "@keyframes introBackgroundHide": {
          "0%": { opacity: 1 },
          "100%": { opacity: 0 },
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background: "linear-gradient(135deg, #d63ca0 0%, #d45a8a 38%, #9232d6 100%)",
          animation: "introBackgroundHide 1ms linear 1020ms forwards",
        }}
      />

      <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 3 }}>
        <Box sx={{ position: "relative", width: INTRO_LOGO_FRAME_SIZE, height: INTRO_LOGO_FRAME_SIZE }}>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              animation: "introLogoSpin 940ms cubic-bezier(0.22, 1, 0.36, 1) forwards, introLogoFade 90ms linear 950ms forwards",
            }}
          >
            <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
              <Image src="/assets/logo.png" alt="SplitMates logo intro" fill sizes="210px" priority style={{ objectFit: "contain" }} />
            </Box>
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "50%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          background: "linear-gradient(135deg, #d63ca0 0%, #d45a8a 38%, #9232d6 100%)",
          borderRight: "1px solid rgba(255,255,255,0.3)",
          zIndex: 2,
          opacity: 0,
          animation: "introSplitLeft 900ms cubic-bezier(0.22, 1, 0.36, 1) 1020ms forwards",
        }}
      >
        <Box sx={{ position: "relative", width: INTRO_LOGO_FRAME_SIZE, height: INTRO_LOGO_FRAME_SIZE }}>
          <Image src="/assets/logo-left.png" alt="SplitMates logo left" fill sizes="210px" priority style={{ objectFit: "contain" }} />
        </Box>
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "50%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          background: "linear-gradient(135deg, #d63ca0 0%, #d45a8a 38%, #9232d6 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.3)",
          zIndex: 2,
          opacity: 0,
          animation: "introSplitRight 900ms cubic-bezier(0.22, 1, 0.36, 1) 1020ms forwards",
        }}
      >
        <Box sx={{ position: "relative", width: INTRO_LOGO_FRAME_SIZE, height: INTRO_LOGO_FRAME_SIZE }}>
          <Image src="/assets/logo-right.png" alt="SplitMates logo right" fill sizes="210px" priority style={{ objectFit: "contain" }} />
        </Box>
      </Box>
    </Box>
  );
}

export function LandingPage() {
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), INTRO_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", background: "transparent" }}>
      {showIntro ? <IntroSplash /> : null}

      <Box
        sx={{
          "@keyframes landingReveal": {
            "0%": { opacity: 0, transform: "translateY(18px) scale(0.985)", filter: "blur(4px)" },
            "100%": { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0px)" },
          },
          animation: showIntro ? "landingReveal 640ms cubic-bezier(0.22, 1, 0.36, 1) 1040ms both" : undefined,
        }}
      >
        <LandingNavbar />

        <Box sx={{ position: "relative", overflow: "hidden", px: { xs: 2, md: 5 }, py: { xs: 3, md: 5 } }}>
          <Box sx={{ width: "100%", px: { xs: 0, md: 2, lg: 4, xl: 8 } }}>
            <Box
              sx={{
                display: "grid",
                gap: { xs: 3, lg: 5 },
                gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" },
                alignItems: { xs: "stretch", lg: "start" },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: { xs: "center", lg: "flex-start" },
                  pt: { lg: 3 },
                }}
              >
                <Stack spacing={3.2} sx={{ maxWidth: 620 }}>
                  <Typography sx={{ fontSize: { xs: 18, md: 22 }, letterSpacing: "0.09em", color: "white", fontWeight: 900, textTransform: "uppercase" }}>
                    ✨ Shared expenses, made simple
                  </Typography>

                  <Typography sx={{ fontFamily: "Georgia, Times New Roman, serif", fontSize: { xs: 44, md: 58 }, lineHeight: 0.98, fontWeight: 700 }}>
                    <Box component="span" sx={{ color: "#f38ea4" }}>Split bills, not </Box>
                    <Box component="span" sx={{ color: "#73c3e8" }}>friendships</Box>
                  </Typography>

                  <Typography sx={{ fontSize: { xs: 20, md: 24 }, color: "rgba(255,255,255,0.72)", lineHeight: 1.55, maxWidth: 610 }}>
                    SplitMates lets you split expenses with friends, roommates or anyone — track who owes what, pay each other back directly through the app, and keep the conversation in one place with built-in group chats. It also helps you understand where your money actually goes, and what you could do differently next month.
                  </Typography>

                  <Stack spacing={2.2}>
                    {featureCards.map((card) => (
                      <Box
                        key={card.title}
                        sx={{
                          borderRadius: 999,
                          p: { xs: 1.8, md: 2.1 },
                          px: { xs: 2.2, md: 2.8 },
                          background: card.color,
                          display: "flex",
                          alignItems: "center",
                          gap: 1.6,
                          boxShadow: "0 12px 26px rgba(99, 48, 153, 0.22)",
                        }}
                      >
                        <Box sx={{ color: "white", display: "grid", placeItems: "center", minWidth: 28 }}>{card.icon}</Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: { xs: 21, md: 25 }, fontWeight: 800, color: "white", lineHeight: 1.1 }}>
                            {card.title}
                          </Typography>
                          <Typography sx={{ fontSize: { xs: 16, md: 19 }, color: "rgba(255,255,255,0.94)", mt: 0.3 }}>
                            {card.text}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", justifyContent: { xs: "center", lg: "flex-start" }, alignItems: "center", gap: 2.6, pt: { lg: 2 } }}>
                <Box
                  sx={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 940,
                    minHeight: { xs: 390, md: 560 },
                    "@keyframes floatBubbleOne": {
                      "0%": { transform: "translate3d(0, 0, 0) rotate(-2deg)" },
                      "50%": { transform: "translate3d(-8px, -14px, 0) rotate(2deg)" },
                      "100%": { transform: "translate3d(0, 0, 0) rotate(-2deg)" },
                    },
                    "@keyframes floatBubbleTwo": {
                      "0%": { transform: "translate3d(0, 0, 0) rotate(1deg)" },
                      "50%": { transform: "translate3d(8px, -12px, 0) rotate(-2deg)" },
                      "100%": { transform: "translate3d(0, 0, 0) rotate(1deg)" },
                    },
                    "@keyframes floatBubbleThree": {
                      "0%": { transform: "translate3d(-50%, 0, 0) rotate(2deg)" },
                      "50%": { transform: "translate3d(calc(-50% + 10px), -10px, 0) rotate(-1deg)" },
                      "100%": { transform: "translate3d(-50%, 0, 0) rotate(2deg)" },
                    },
                  }}
                >
                  <Image
                    src="/assets/laptop.png"
                    alt="SplitMates laptop preview"
                    fill
                    sizes="(max-width: 1200px) 100vw, 940px"
                    style={{ objectFit: "contain" }}
                    priority
                  />

                  {floatingBubbles.map((bubble) => (
                    <Chip
                      key={bubble.label}
                      label={bubble.label}
                      sx={{
                        display: "inline-flex",
                        position: "absolute",
                        zIndex: 2,
                        background: bubble.bg,
                        border: `1px solid ${bubble.color}60`,
                        boxShadow: bubble.shadow,
                        backdropFilter: "blur(8px)",
                        fontSize: { xs: 16, md: 21 },
                        height: { xs: 42, md: 50 },
                        px: { xs: 1.2, md: 1.4 },
                        "& .MuiChip-label": { px: { xs: 1.4, md: 1.8 }, fontWeight: 800, color: "white" },
                        ...bubble.sx,
                      }}
                    />
                  ))}
                </Box>

                <Button
                  component={Link}
                  href="/signup"
                  variant="contained"
                  sx={{
                    borderRadius: 999,
                    minWidth: { xs: 230, md: 280 },
                    height: { xs: 58, md: 70 },
                    background: "linear-gradient(90deg, #e83ea8, #6f29c6)",
                    fontSize: { xs: 26, md: 34 },
                    fontWeight: 800,
                    boxShadow: "none",
                    mt: { xs: 4, md: 6 },
                    "&:hover": { background: "linear-gradient(90deg, #d83799, #6526b2)", boxShadow: "none" },
                  }}
                >
                  Get started
                </Button>

                <Typography sx={{ fontSize: { xs: 19, md: 24 }, color: "rgba(255,255,255,0.65)" }}>
                  Already have an account?{" "}
                  <Box component={Link} href="/login" sx={{ color: "#e83ea8", fontWeight: 800, textDecoration: "none" }}>
                    Log in
                  </Box>
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
