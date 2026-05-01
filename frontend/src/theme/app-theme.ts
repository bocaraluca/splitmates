import { alpha, createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#e83ea8",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#56c9ef",
    },
    background: {
      default: "#faf5ff",
      paper: "rgba(255, 255, 255, 0.9)",
    },
    text: {
      primary: "#2f2742",
      secondary: "#675e84",
    },
    divider: alpha("#a047d8", 0.2),
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
          background:
            "radial-gradient(circle at top left, rgba(239, 86, 177, 0.2), transparent 30%), radial-gradient(circle at top right, rgba(95, 212, 244, 0.2), transparent 28%), linear-gradient(180deg, #fbf2ff 0%, #f4eaff 100%)",
          color: "#2f2742",
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
