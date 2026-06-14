/**
 * Data layer for fetching and transforming video library data.
 * All functions are async and use the shared API client.
 */

import { fetchVideos as apiFetchVideos, fetchVideo as apiFetchVideo } from '../api/client';
import type { HydratedVideo } from '../types';

export interface FetchVideosParams {
  limit?: number;
  offset?: number;
  platform?: 'tiktok' | 'instagram' | 'youtube';
  content_type?: 'recipe' | 'workout' | 'tutorial_diy' | 'beauty_fashion' | 'education' | 'entertainment' | 'general';
  status?: 'queued' | 'fetching_metadata' | 'analyzing' | 'ready' | 'failed';
  q?: string;
  collection_id?: string;
  creator?: string;
}

export interface FetchVideosResult {
  items: HydratedVideo[];
  limit: number;
  offset: number;
}

/**
 * Fetch videos with optional filtering and pagination.
 */
export async function fetchVideos(params?: FetchVideosParams): Promise<FetchVideosResult> {
  return apiFetchVideos(params);
}

/**
 * Fetch a single video by ID.
 */
export async function fetchVideo(id: string): Promise<HydratedVideo> {
  const result = await apiFetchVideo(id);
  return result.video;
}

/**
 * Search videos by query string.
 */
export async function searchVideos(params: {
  q: string;
  limit?: number;
  offset?: number;
}): Promise<FetchVideosResult> {
  return apiFetchVideos({ ...params });
}
