import { HydratedVideo, CollectionItem, CollectionDetail } from '../types';

// Read API base URL from environment variable with fallback
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

let authToken: string | null = null;

/**
 * Set the authentication token for API requests.
 * This should be called after successful Supabase authentication.
 */
export function setAuthToken(token: string | null) {
  authToken = token;
}

/**
 * Get the current authentication token.
 */
export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Clear the authentication token.
 * This should be called on logout or when receiving 401 errors.
 */
export function clearAuthToken() {
  authToken = null;
}

/**
 * Internal fetch wrapper that handles authentication and error responses.
 */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized - clear token and throw
  if (response.status === 401) {
    clearAuthToken();
    throw new Error('Unauthorized - please log in again');
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`API error ${response.status}: ${errorBody || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined,
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export async function fetchVideos(params?: {
  limit?: number;
  offset?: number;
  platform?: string;
  content_type?: string;
  status?: string;
  q?: string;
  collection_id?: string;
  creator?: string;
}): Promise<{ items: HydratedVideo[]; limit: number; offset: number }> {
  const query = buildQuery({
    limit: params?.limit,
    offset: params?.offset,
    platform: params?.platform,
    content_type: params?.content_type,
    status: params?.status,
    q: params?.q,
    collection_id: params?.collection_id,
    creator: params?.creator,
  });
  return apiFetch(`/videos${query}`);
}

export async function fetchVideo(id: string): Promise<{ video: HydratedVideo }> {
  return apiFetch(`/videos/${id}`);
}

export async function searchVideos(params: {
  q: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: HydratedVideo[]; limit: number; offset: number }> {
  const query = buildQuery({
    q: params.q,
    limit: params.limit,
    offset: params.offset,
  });
  return apiFetch(`/search${query}`);
}

export async function fetchSuggestions(
  q?: string,
  limit?: number,
): Promise<{ suggestions: string[] }> {
  const query = buildQuery({ q, limit });
  return apiFetch(`/search/suggestions${query}`);
}

export async function fetchCollections(): Promise<{ items: CollectionItem[] }> {
  return apiFetch('/collections');
}

export async function fetchCollection(
  id: string,
): Promise<{ collection: CollectionDetail }> {
  return apiFetch(`/collections/${id}`);
}

export async function saveVideo(
  url: string,
): Promise<{ is_new: boolean; video: HydratedVideo | null; queue_enqueued: boolean }> {
  return apiFetch('/videos/save', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function deleteVideo(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/videos/${id}`, { method: 'DELETE' });
}

export async function addTags(
  videoId: string,
  tags: string[],
): Promise<{ ok: boolean; tags: string[] }> {
  return apiFetch(`/videos/${videoId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags }),
  });
}
