import { apiFetch } from "../api/client";
import { refreshAccessToken } from "./auth-api";
import { getAccessToken, clearTokens } from "./storage";

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

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
  } catch (error: unknown) {
    if (getErrorStatus(error) === 401) {
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
        } catch (retryError: unknown) {
          if (getErrorStatus(retryError) === 401) {
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
