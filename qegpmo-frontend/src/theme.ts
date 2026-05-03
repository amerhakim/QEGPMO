import { createTheme } from "@mui/material";

export const ragColors = {
  GREEN: "#2e7d32",
  AMBER: "#ed6c02",
  RED: "#d32f2f",
  UNKNOWN: "#616161"
};

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0b4f8a"
    },
    secondary: {
      main: "#00695f"
    },
    background: {
      default: "#f5f7fa"
    }
  },
  shape: {
    borderRadius: 10
  }
});
