import { apiFetch } from "../api/client";
import { getRefreshToken, storeTokens } from "./storage";

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  refresh_expires_at?: string;
};

export type RefreshResponse = {
  access_token: string;
  expires_at: string;
};

export async function login(email: string, password: string) {
  const response = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  storeTokens(response.access_token, response.refresh_token);
  return response;
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }
  const response = await apiFetch<RefreshResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  storeTokens(response.access_token, null);
  return response;
}
