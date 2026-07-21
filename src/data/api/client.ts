export const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api/v1").replace(/\/$/, "");

export type ApiError = {
  status: number;
  message: string;
  field_errors?: Record<string, string>;
};

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const hasBody = options.body !== undefined && options.body !== null;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const body = JSON.parse(text) as { message?: string; field_errors?: Record<string, string> };
      throw { status: response.status, message: body.message ?? text, field_errors: body.field_errors } satisfies ApiError;
    } catch (error) {
      if (typeof error === "object" && error && "status" in error) throw error;
      throw { status: response.status, message: text } satisfies ApiError;
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
