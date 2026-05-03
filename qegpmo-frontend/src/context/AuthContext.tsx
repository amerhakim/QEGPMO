import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient, setApiAuthContext } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { AuthResponse, User } from "../types";

interface LoginPayload {
  username: string;
  password: string;
  tenantId: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  loginMock: (role: User["role"], tenantId: string) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "qegpmo.accessToken";
const USER_KEY = "qegpmo.user";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const existingToken = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    if (existingToken && rawUser) {
      const parsed = JSON.parse(rawUser) as User;
      setUser(parsed);
      setToken(existingToken);
      setApiAuthContext(existingToken, parsed.tenantId);
    }
    setIsLoading(false);
  }, []);

  const login = async (payload: LoginPayload) => {
    const { data } = await apiClient.post<AuthResponse>(endpoints.login, payload);
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    setToken(data.accessToken);
    setApiAuthContext(data.accessToken, data.user.tenantId);
  };

  const loginMock = (role: User["role"], tenantId: string) => {
    const mockUser: User = {
      userId: `mock-${role.toLowerCase()}`,
      username: role.toLowerCase(),
      name: `Mock ${role.replace("_", " ")}`,
      role,
      tenantId,
      permissions:
        role === "EXECUTIVE"
          ? ["dashboard.read", "project.read", "export.dashboard"]
          : role === "PMO"
            ? [
                "dashboard.read",
                "project.read",
                "project.create",
                "project.update",
                "project.workflow.submit",
                "project.workflow.approve",
                "project.workflow.reject",
                "export.dashboard",
                "project.export"
              ]
            : ["project.read", "project.update", "project.workflow.submit"]
    };
    const mockToken = "mock-token";
    localStorage.setItem(TOKEN_KEY, mockToken);
    localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
    setUser(mockUser);
    setToken(mockToken);
    setApiAuthContext(mockToken, tenantId);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
    setApiAuthContext(null, null);
  };

  const hasPermission = (permission: string) => {
    return user?.permissions.includes(permission) ?? false;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      loginMock,
      logout,
      hasPermission
    }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
