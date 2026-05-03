import { Alert, Box, Button, Stack } from "@mui/material";

export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => {
  return (
    <Box sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Alert severity="error">{message}</Alert>
        {onRetry ? (
          <Button variant="outlined" onClick={onRetry} sx={{ alignSelf: "start" }}>
            Retry
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
};
