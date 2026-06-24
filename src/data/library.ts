import { fetchVideos as apiFetchVideos, fetchVideo as apiFetchVideo, searchVideos as apiSearchVideos, saveVideo as apiSaveVideo } from '../api/client';
import type { HydratedVideo, VideoItem } from '../types';
import { formatRelativeTime, formatContentType, formatPlatform } from '../utils/format';

const THUMBNAIL_PALETTE = [
  '#d97706', '#059669', '#6366f1', '#7c3aed',
  '#dc2626', '#0891b2', '#a16207', '#2563eb',
];

const PLATFORM_TITLE_FALLBACKS: Record<string, string> = {
  youtube: 'YouTube video',
  instagram: 'Instagram reel',
  tiktok: 'TikTok video',
  twitter: 'X post',
};

function pickColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return THUMBNAIL_PALETTE[Math.abs(hash) % THUMBNAIL_PALETTE.length];
}

function isPlaceholderText(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    /^stub (youtube|instagram|tiktok|twitter\/x) (title|description|post) for\b/.test(normalized) ||
    normalized === 'metadata is limited; this appears to be general video content with unclear subject matter.' ||
    normalized.startsWith('metadata suggests ')
  );
}

function cleanText(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || isPlaceholderText(trimmed)) {
    return null;
  }
  return trimmed;
}

function cleanThumbnailUrl(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes('placehold.co')) {
    return undefined;
  }
  return trimmed;
}

function platformFallbackTitle(platform: string): string {
  return PLATFORM_TITLE_FALLBACKS[platform] ?? 'Saved video';
}

function toVideoItem(v: HydratedVideo): VideoItem {
  const title = cleanText(v.title) ?? platformFallbackTitle(v.platform);
  const summary = cleanText(v.summary) ?? cleanText(v.description) ?? '';
  const creator = cleanText(v.creator_handle) ?? cleanText(v.creator_name) ?? 'Unknown';

  return {
    id: v.id,
    title,
    creator,
    summary,
    platform: formatPlatform(v.platform),
    status: v.analysis_status === 'completed' ? 'Ready' : v.status,
    thumbnailColor: pickColor(v.id),
    thumbnailUrl: cleanThumbnailUrl(v.thumbnail_url),
    savedAgo: formatRelativeTime(v.saved_at),
    tags: v.tags.map((t) => t.tag),
    collection: v.collections[0]?.name ?? 'General',
    sourceUrl: v.source_url,
    embedUrl: v.embed_url ?? undefined,
    embedHtml: v.embed_html ?? undefined,
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

export async function saveVideo(url: string): Promise<{
  is_new: boolean;
  video: VideoItem | null;
  queue_enqueued: boolean;
}> {
  const res = await apiSaveVideo(url);
  return {
    is_new: res.is_new,
    video: res.video ? toVideoItem(res.video) : null,
    queue_enqueued: res.queue_enqueued,
  };
}

export { fetchCollections, fetchCollection, fetchVideoStatus } from '../api/client';
export { toVideoItem, pickColor };
