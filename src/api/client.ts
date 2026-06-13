import { createClient, Session } from '@supabase/supabase-js';
import { HydratedVideo, CollectionItem, CollectionDetail } from '../types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

let supabaseClient: ReturnType<typeof createClient> | null = null;
let currentSession: Session | null = null;
let authListenerInitialized = false;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!authListenerInitialized) {
    authListenerInitialized = true;
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
    });
  }
  return supabaseClient;
}

export function getAccessToken(): string | null {
  return currentSession?.access_token ?? null;
}

export function getCurrentSession(): Session | null {
  return currentSession;
}

export async function signOut() {
  const client = getSupabase();
  if (client) {
    await client.auth.signOut();
  }
  currentSession = null;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    await signOut();
    throw new Error('Session expired. Please sign in again.');
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
