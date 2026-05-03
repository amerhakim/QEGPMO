import { AppBar, Box, Button, Chip, Container, Stack, Toolbar, Typography } from "@mui/material";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <Box>
      <AppBar position="sticky" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            QEGPMO
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button color="inherit" component={NavLink} to="/dashboard">
              Dashboard
            </Button>
            <Button color="inherit" component={NavLink} to="/projects">
              Projects
            </Button>
            {user ? (
              <>
                <Chip size="small" label={`Tenant: ${user.tenantId}`} />
                <Chip size="small" label={user.role} />
                <Button
                  color="inherit"
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                >
                  Logout
                </Button>
              </>
            ) : null}
          </Stack>
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 3 }}>{children}</Container>
    </Box>
  );
};
