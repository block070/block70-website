import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

export type AlphaPostDto = {
  id: number;
  user_id: number;
  title: string;
  content: string;
  token_symbol: string | null;
  chain: string | null;
  alpha_type: string;
  confidence_score: number;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
  vote_score?: number;
  comment_count?: number;
};

export type AlphaCommentDto = {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
  author_name?: string | null;
};

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Community API error: ${res.status}`);
  return (await res.json()) as T;
}

export async function getAlphaPosts(params?: {
  token_symbol?: string;
  alpha_type?: string;
  limit?: number;
  offset?: number;
}): Promise<AlphaPostDto[]> {
  const sp = new URLSearchParams();
  if (params?.token_symbol) sp.set("token_symbol", params.token_symbol);
  if (params?.alpha_type) sp.set("alpha_type", params.alpha_type);
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  const q = sp.toString();
  const res = await fetch(`${API_BASE_URL}/api/v1/alpha/posts${q ? `?${q}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load posts");
  return (await res.json()) as AlphaPostDto[];
}

export async function getAlphaPost(id: number): Promise<AlphaPostDto> {
  const res = await fetch(`${API_BASE_URL}/api/v1/alpha/posts/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Post not found");
  return (await res.json()) as AlphaPostDto;
}

export async function createAlphaPost(payload: {
  title: string;
  content: string;
  token_symbol?: string | null;
  chain?: string | null;
  alpha_type: string;
  confidence_score: number;
}): Promise<AlphaPostDto> {
  return fetchWithAuth<AlphaPostDto>("/api/v1/alpha/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function voteAlphaPost(
  postId: number,
  voteType: "up" | "down"
): Promise<{ post_id: number; vote_type: string; vote_score: number }> {
  return fetchWithAuth("/api/v1/alpha/vote", {
    method: "POST",
    body: JSON.stringify({ post_id: postId, vote_type: voteType }),
  });
}

export async function createAlphaComment(
  postId: number,
  content: string
): Promise<AlphaCommentDto> {
  return fetchWithAuth<AlphaCommentDto>("/api/v1/alpha/comment", {
    method: "POST",
    body: JSON.stringify({ post_id: postId, content }),
  });
}

export async function getAlphaPostComments(postId: number): Promise<AlphaCommentDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/alpha/posts/${postId}/comments`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load comments");
  return (await res.json()) as AlphaCommentDto[];
}

export async function getTrendingAlpha(limit = 20): Promise<AlphaPostDto[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/alpha/trending?limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load trending");
  return (await res.json()) as AlphaPostDto[];
}

export async function getAlphaLeaderboard(limit = 50): Promise<
  Array<{
    user_id: number;
    name: string;
    reputation_score: number;
    alpha_accuracy: number;
    followers: number;
  }>
> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/alpha/leaderboard?limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return (await res.json()) as Array<{
    user_id: number;
    name: string;
    reputation_score: number;
    alpha_accuracy: number;
    followers: number;
  }>;
}

export async function getUserAlphaProfile(userId: number): Promise<{
  user_id: number;
  name: string;
  reputation_score: number;
  alpha_accuracy: number;
  followers: number;
  post_count: number;
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/alpha/users/${userId}/profile`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("User not found");
  return (await res.json()) as {
    user_id: number;
    name: string;
    reputation_score: number;
    alpha_accuracy: number;
    followers: number;
    post_count: number;
  };
}

export async function getUserAlphaPosts(
  userId: number,
  limit = 50
): Promise<AlphaPostDto[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/alpha/users/${userId}/posts?limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load posts");
  return (await res.json()) as AlphaPostDto[];
}

export async function followUser(followingId: number): Promise<{ status: string }> {
  return fetchWithAuth("/api/v1/alpha/follow", {
    method: "POST",
    body: JSON.stringify({ following_id: followingId }),
  });
}

export async function unfollowUser(followingId: number): Promise<{ status: string }> {
  return fetchWithAuth(
    `/api/v1/alpha/follow?following_id=${followingId}`,
    { method: "DELETE" }
  );
}
