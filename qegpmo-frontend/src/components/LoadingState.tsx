import { Box, CircularProgress, Typography } from "@mui/material";

export const LoadingState = ({ message = "Loading..." }: { message?: string }) => {
  return (
    <Box sx={{ display: "grid", placeItems: "center", py: 6, gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
};
