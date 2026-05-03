import { Alert, Stack, Typography } from "@mui/material";

export const UnauthorizedPage = () => {
  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={700}>
        Access Denied
      </Typography>
      <Alert severity="warning">
        Your role does not have permission to access this feature. Contact PMO administration if this is unexpected.
      </Alert>
    </Stack>
  );
};
