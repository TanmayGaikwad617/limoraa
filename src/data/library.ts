import { HydratedVideo, VideoItem } from '../types';
import { formatRelativeTime, formatContentType, formatPlatform } from '../utils/format';
import {
  fetchVideos as apiFetchVideos,
  fetchVideo as apiFetchVideo,
  searchVideos as apiSearchVideos,
  saveVideo as apiSaveVideo,
  deleteVideo as apiDeleteVideo,
} from '../api/client';

const THUMBNAIL_PALETTE = [
  '#d97706', '#059669', '#6366f1', '#7c3aed',
  '#dc2626', '#0891b2', '#a16207', '#2563eb',
];

function pickColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return THUMBNAIL_PALETTE[Math.abs(hash) % THUMBNAIL_PALETTE.length];
}

function toVideoItem(v: HydratedVideo): VideoItem {
  return {
    id: v.id,
    title: v.title ?? 'Untitled',
    creator: v.creator_handle ?? v.creator_name ?? 'Unknown',
    summary: v.summary ?? v.description ?? '',
    platform: formatPlatform(v.platform),
    status: v.analysis_status === 'completed' ? 'Ready' : v.status,
    thumbnailColor: pickColor(v.id),
    savedAgo: formatRelativeTime(v.saved_at),
    tags: v.tags.map((t) => t.tag),
    collection: v.collections[0]?.name ?? 'General',
    sourceUrl: v.source_url,
    embedUrl: v.embed_url ?? undefined,
    type: formatContentType(v.content_type),
  };
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
}): Promise<VideoItem[]> {
  const res = await apiFetchVideos(params);
  return res.items.map(toVideoItem);
}

export async function fetchVideo(id: string): Promise<VideoItem | null> {
  const res = await apiFetchVideo(id);
  return res.video ? toVideoItem(res.video) : null;
}

export async function searchVideos(params: {
  q: string;
  limit?: number;
  offset?: number;
}): Promise<VideoItem[]> {
  const res = await apiSearchVideos(params);
  return res.items.map(toVideoItem);
}

export async function saveVideo(url: string) {
  return apiSaveVideo(url);
}

export async function deleteVideo(id: string) {
  return apiDeleteVideo(id);
}

export { fetchCollections, fetchCollection } from '../api/client';
