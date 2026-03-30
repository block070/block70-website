const TOKEN_KEY = "block70_access_token";

function detailFromResponseBody(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = (data as { detail?: unknown }).detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((item) =>
        typeof item === "object" && item && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : String(item),
      )
      .filter(Boolean)
      .join(", ");
  }
  return null;
}

type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  plan: "free" | "pro" | "elite" | "quant" | "admin";
  plan_type: "free" | "pro" | "elite" | "quant";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  trial_end?: string | null;
  subscription_status?: string | null;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  user?: User;
};

function setPlanCookie(plan: string) {
  if (typeof window === "undefined") return;
  document.cookie = `block70_plan=${encodeURIComponent(plan)}; path=/; max-age=2592000; SameSite=Lax`;
}

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
  document.cookie = "block70_plan=; path=/; max-age=0; SameSite=Lax";
}

export async function login(params: {
  email: string;
  password: string;
}): Promise<User> {
  const res = await fetch(`/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = (await res.json().catch(() => ({}))) as LoginResponse & { detail?: unknown };
  if (!res.ok) {
    throw new Error(detailFromResponseBody(data) || "Invalid email or password");
  }
  setToken(data.access_token);
  setPlanCookie(data.user?.plan_type ?? data.user?.plan ?? "free");

  return getCurrentUser();
}

/** Passwordless lead: creates account, returns JWT; check email for password link. */
export async function registerLead(params: {
  email: string;
  name?: string;
  accept_terms?: boolean;
  accept_privacy?: boolean;
  accept_disclaimer?: boolean;
  ref_code?: string | null;
  ref_source?: string | null;
}): Promise<{
  access_token: string | null;
  user?: User;
  detail?: string;
}> {
  const res = await fetch(`/api/auth/register-lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.email.trim(),
      name: params.name,
      accept_terms: params.accept_terms ?? true,
      accept_privacy: params.accept_privacy ?? true,
      accept_disclaimer: params.accept_disclaimer ?? true,
      ref_code: params.ref_code,
      ref_source: params.ref_source,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as LeadRegisterResponse & {
    detail?: unknown;
  };
  if (!res.ok) {
    throw new Error(detailFromResponseBody(data) || "Could not create account");
  }
  const token =
    typeof data.access_token === "string" ? data.access_token : null;
  if (token) {
    setToken(token);
    setPlanCookie(data.user?.plan_type ?? data.user?.plan ?? "free");
  }
  return {
    access_token: token,
    user: data.user,
    detail: typeof data.detail === "string" ? data.detail : undefined,
  };
}

type LeadRegisterResponse = {
  access_token?: string | null;
  user?: User;
  detail?: string;
};

export async function register(params: {
  email: string;
  password: string;
  name?: string;
  ref_code?: string | null;
  ref_source?: string | null;
  accept_terms?: boolean;
  accept_privacy?: boolean;
  accept_disclaimer?: boolean;
}): Promise<User> {
  const body: Record<string, string | boolean | null | undefined> = {
    email: params.email,
    password: params.password,
    name: params.name,
    ref_code: params.ref_code,
    ref_source: params.ref_source,
    accept_terms: params.accept_terms,
    accept_privacy: params.accept_privacy,
    accept_disclaimer: params.accept_disclaimer,
  };
  const res = await fetch(`/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as LoginResponse & { detail?: unknown };
  if (!res.ok) {
    throw new Error(detailFromResponseBody(data) || "Registration failed");
  }
  if (data.access_token) {
    setToken(data.access_token);
    setPlanCookie(data.user?.plan_type ?? data.user?.plan ?? "free");
  }
  return getCurrentUser();
}

export async function requestPasswordReset(params: { email: string }): Promise<string> {
  const res = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: params.email.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(detailFromResponseBody(data) || "Could not start password reset");
  }
  return typeof data?.detail === "string" ? data.detail : "";
}

export async function resetPasswordWithToken(params: {
  token: string;
  password: string;
}): Promise<string> {
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: params.token, password: params.password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(detailFromResponseBody(data) || "Password reset failed");
  }
  return typeof data?.detail === "string" ? data.detail : "";
}

export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    clearToken();
  }
}

export async function getCurrentUser(): Promise<User> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`/api/auth/me`, {
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

  const user = (await res.json()) as User;
  setPlanCookie(user.plan_type ?? user.plan ?? "free");
  return user;
}

export async function upgradeToPro(): Promise<User> {
  const res = await fetch("/api/admin/upgrade-me", { method: "POST" });
  if (!res.ok) {
    throw new Error("Upgrade failed");
  }
  const data = (await res.json()) as { user?: User };
  const user = data.user;
  if (!user) {
    throw new Error("Upgrade response missing user");
  }
  setPlanCookie(user.plan_type ?? user.plan ?? "pro");
  return user;
}

