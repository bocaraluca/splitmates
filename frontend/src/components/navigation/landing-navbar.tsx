"use client";

import Image from "next/image";
import Link from "next/link";
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";

export function LandingNavbar() {
  return (
    <AppBar
      position="sticky"
      sx={{
        top: 0,
        background: "linear-gradient(90deg, #5b36c8 0%, #d841aa 54%, #52c7ea 100%)",
        borderTop: 0,
        borderBottom: "1px solid rgba(255,255,255,0.22)",
      }}
    >
      <Container maxWidth={false} sx={{ px: { xs: 2, md: 3 } }}>
        <Toolbar disableGutters sx={{ minHeight: { xs: 72, md: 86 }, gap: 2, position: "relative" }}>
          <Button
            component={Link}
            href="/"
            color="inherit"
            sx={{
              minWidth: 0,
              px: 0,
              display: "flex",
              alignItems: "center",
              gap: 1,
              textTransform: "none",
              zIndex: 2,
            }}
          >
            <Box
              sx={{
                width: 58,
                height: 58,
                overflow: "hidden",
                flex: "0 0 auto",
              }}
            >
              <Image src="/assets/logo.png" alt="SplitMates logo" width={58} height={58} priority />
            </Box>
          </Button>

          <Typography
            sx={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: { xs: 46, md: 50 },
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              textShadow: "0 1px 0 rgba(64, 57, 98, 0.25)",
              opacity: { xs: 0, sm: 1 },
              pointerEvents: "none",
            }}
          >
            <Box component="span" sx={{ color: "#f38ea4" }}>
              Split
            </Box>
            <Box component="span" sx={{ color: "#73c3e8" }}>
              Mates
            </Box>
          </Typography>

          <Stack
            direction="row"
            spacing={1.2}
            sx={{
              ml: "auto",
              alignItems: "center",
              zIndex: 2,
            }}
          >
            <Button
              component={Link}
              href="/login"
              variant="contained"
              size="medium"
              sx={{
                borderRadius: 999,
                minWidth: 96,
                bgcolor: "#eef3ff",
                color: "#7448b0",
                fontWeight: 800,
                boxShadow: "none",
                "&:hover": { bgcolor: "#e3ebff", boxShadow: "none" },
              }}
            >
              Log in
            </Button>
            <Button
              component={Link}
              href="/signup"
              variant="contained"
              size="medium"
              sx={{
                borderRadius: 999,
                minWidth: 106,
                bgcolor: "#7448b0",
                color: "white",
                fontWeight: 800,
                boxShadow: "none",
                "&:hover": { bgcolor: "#673e9f", boxShadow: "none" },
              }}
            >
              Sign up
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
