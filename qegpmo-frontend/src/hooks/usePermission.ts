import { useAuth } from "../context/AuthContext";

export const usePermission = (permission: string) => {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
};
