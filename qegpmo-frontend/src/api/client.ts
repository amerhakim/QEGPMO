import axios from "axios";
import { API_BASE_URL } from "./endpoints";

let accessToken: string | null = null;
let tenantId: string | null = null;

export const setApiAuthContext = (token: string | null, tenant: string | null) => {
  accessToken = token;
  tenantId = tenant;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (tenantId) {
    config.headers["x-tenant-id"] = tenantId;
  }
  config.headers["x-client-app"] = "qegpmo-frontend";
  return config;
});
