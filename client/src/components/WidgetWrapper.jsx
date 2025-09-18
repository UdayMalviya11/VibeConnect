import { Box } from "@mui/material";
import { styled } from "@mui/system";

const WidgetWrapper = styled(Box)(({ theme }) => ({
  padding: "1.25rem 1.25rem 0.75rem 1.25rem",
  backgroundColor: theme.palette.background.alt,
  borderRadius: "6px",
  boxShadow:
    theme.palette.mode === "dark"
      ? "0 2px 14px rgba(0,0,0,0.35)"
      : "0 6px 20px rgba(0,0,0,0.08)",
  transition: "box-shadow 200ms ease, transform 200ms ease",
  "&:hover": {
    boxShadow:
      theme.palette.mode === "dark"
        ? "0 6px 22px rgba(0,0,0,0.45)"
        : "0 10px 28px rgba(0,0,0,0.12)",
    transform: "translateY(-2px)",
  },
}));

export default WidgetWrapper;
