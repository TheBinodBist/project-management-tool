const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const ACCESS_TOKEN_KEY = "project-workspace.access";
const REFRESH_TOKEN_KEY = "project-workspace.refresh";

export type ApiUser = {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string;
};

export type Workspace = {
  id: number;
  name: string;
  slug: string;
  description: string;
  my_role: string;
  member_count: number;
  created_at: string;
};

export type Project = {
  id: number;
  workspace: number;
  name: string;
  description: string;
  is_archived: boolean;
  created_by: ApiUser | null;
  created_at: string;
  updated_at: string;
};

type TokenPair = {
  access: string;
  refresh: string;
  user: ApiUser;
};

function getStoredToken(key: string) {
  return typeof window === "undefined" ? null : window.localStorage.getItem(key);
}

export function saveTokens(tokens: Pick<TokenPair, "access" | "refresh">) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken() {
  return getStoredToken(ACCESS_TOKEN_KEY);
}

async function refreshAccessToken() {
  const refresh = getStoredToken(REFRESH_TOKEN_KEY);
  if (!refresh) return null;

  const response = await fetch(`${API_BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    clearTokens();
    return null;
  }

  const tokens = (await response.json()) as { access: string; refresh?: string };
  saveTokens({ access: tokens.access, refresh: tokens.refresh ?? refresh });
  return tokens.access;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getErrorMessage(body: unknown) {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const errors = Object.values(body as Record<string, unknown>)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value): value is string => typeof value === "string");
    if (errors.length) return errors.join(" ");
  }
  return "The request failed. Please try again.";
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const access = getAccessToken();
  if (access) headers.set("Authorization", `Bearer ${access}`);

  const request = () => fetch(`${API_BASE}${path}`, { ...init, headers });
  let response = await request();

  if (response.status === 401 && access) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${refreshed}`);
      response = await request();
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(getErrorMessage(body), response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function loginRequest(email: string, password: string) {
  return apiRequest<TokenPair>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function registerRequest(
  email: string,
  full_name: string,
  password: string,
) {
  return apiRequest<TokenPair>("/auth/register/", {
    method: "POST",
    body: JSON.stringify({ email, full_name, password }),
  });
}
