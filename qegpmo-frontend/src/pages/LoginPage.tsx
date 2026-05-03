import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, loginMock } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("tenant-a");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setIsBusy(true);
    try {
      await login({ username, password, tenantId });
      navigate("/dashboard");
    } catch (e) {
      setError("Login failed. Verify credentials and backend availability.");
    } finally {
      setIsBusy(false);
    }
  };

  const quickMockLogin = (role: UserRole) => {
    loginMock(role, tenantId);
    navigate("/dashboard");
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Card sx={{ width: "100%", maxWidth: 480 }}>
        <CardContent>
          <Stack spacing={2.5}>
            <Typography variant="h5" fontWeight={700}>
              QEGPMO Login
            </Typography>
            <Typography color="text.secondary">Tenant-aware access with RBAC-protected routes.</Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField label="Tenant ID" value={tenantId} onChange={(e) => setTenantId(e.target.value)} fullWidth />
            <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} fullWidth />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
            />
            <Button variant="contained" onClick={submit} disabled={isBusy}>
              Sign In
            </Button>
            <Typography variant="body2" color="text.secondary">
              Local testing quick login
            </Typography>
            <TextField
              select
              label="Role"
              defaultValue="EXECUTIVE"
              onChange={(e) => quickMockLogin(e.target.value as UserRole)}
              helperText="Selecting a role logs in immediately using mock mode."
            >
              <MenuItem value="EXECUTIVE">Executive</MenuItem>
              <MenuItem value="PMO">PMO</MenuItem>
              <MenuItem value="PROJECT_MANAGER">Project Manager</MenuItem>
            </TextField>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
