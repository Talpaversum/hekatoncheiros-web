import { apiFetch } from "../api/client";
import { refreshAccessToken } from "./auth-api";
import { getAccessToken, clearTokens } from "./storage";

export async function authFetch<T>(path: string, options: RequestInit = {}) {
  let token = getAccessToken();
  if (!token) {
    await refreshAccessToken();
    token = getAccessToken();
  }

  if (!token) {
    throw { status: 401, message: "Missing access token" };
  }

  try {
    return await apiFetch<T>(path, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error: any) {
    if (error?.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const retryToken = getAccessToken();
        try {
          return apiFetch<T>(path, {
            ...options,
            headers: {
              ...(options.headers ?? {}),
              ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {}),
            },
          });
        } catch (retryError: any) {
          if (retryError?.status === 401) {
            clearTokens();
          }
          throw retryError;
        }
      }

      clearTokens();
    }

    throw error;
  }
}
