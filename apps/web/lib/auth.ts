import { API_BASE_URL } from "./api";

const TOKEN_KEY = "block70_access_token";

type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  plan_type: "free" | "pro" | "elite";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  document.cookie = `block70_session=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`;
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  document.cookie = "block70_session=; path=/; max-age=0; SameSite=Lax";
}

export async function login(params: {
  email: string;
  password: string;
}): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login?email=${encodeURIComponent(
    params.email,
  )}&password=${encodeURIComponent(params.password)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Invalid email or password");
  }

  const data = (await res.json()) as LoginResponse;
  setToken(data.access_token);

  return getCurrentUser();
}

export async function register(params: {
  email: string;
  password: string;
  name: string;
  ref_code?: string | null;
  ref_source?: string | null;
  accept_terms: boolean;
  accept_privacy: boolean;
  accept_disclaimer: boolean;
}): Promise<User> {
  const body: Record<string, string | boolean> = {
    email: params.email,
    password: params.password,
    name: params.name,
    accept_terms: params.accept_terms,
    accept_privacy: params.accept_privacy,
    accept_disclaimer: params.accept_disclaimer,
  };
  if (params.ref_code) body.ref_code = params.ref_code;
  if (params.ref_source) body.ref_source = params.ref_source;
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error("Registration failed");
  }

  // Auto-login after registration
  return login({ email: params.email, password: params.password });
}

export async function getCurrentUser(): Promise<User> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
    }
    throw new Error("Failed to fetch current user");
  }

  return (await res.json()) as User;
}

