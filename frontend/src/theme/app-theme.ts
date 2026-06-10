import { alpha, createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#d841aa",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#56c9ef",
    },
    background: {
      default: "#120228",
      paper: "rgba(255, 255, 255, 0.06)",
    },
    text: {
      primary: "rgba(255, 255, 255, 0.93)",
      secondary: "rgba(255, 255, 255, 0.55)",
    },
    divider: "rgba(255, 255, 255, 0.1)",
  },
  shape: {
    borderRadius: 20,
  },
  typography: {
    fontFamily: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
    h1: {
      fontWeight: 700,
      letterSpacing: "-0.04em",
    },
    h2: {
      fontWeight: 700,
      letterSpacing: "-0.03em",
    },
    h3: {
      fontWeight: 700,
    },
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: "linear-gradient(135deg, #1a0533 0%, #2d0a4e 40%, #0f1a3d 100%) fixed",
          backgroundAttachment: "fixed",
          minHeight: "100vh",
          color: "rgba(255,255,255,0.93)",
        },
        a: {
          color: "inherit",
          textDecoration: "none",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: "linear-gradient(90deg, rgba(118, 45, 203, 0.78), rgba(230, 67, 172, 0.76), rgba(87, 200, 238, 0.76))",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
  },
});
