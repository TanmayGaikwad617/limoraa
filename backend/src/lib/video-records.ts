import type { PoolClient, QueryResultRow } from "pg";
import { buildSearchText } from "./video.js";

export interface VideoBaseRow extends QueryResultRow {
  id: string;
  user_id: string;
  source_url: string;
  normalized_url: string;
  platform: string;
  platform_video_id: string | null;
  content_type: string | null;
  title: string | null;
  description: string | null;
  caption: string | null;
  hashtags_json: unknown;
  creator_name: string | null;
  creator_handle: string | null;
  thumbnail_url: string | null;
  embed_url: string | null;
  embed_html: string | null;
  duration_seconds: number | null;
  language_code: string | null;
  status: string;
  metadata_status: string;
  analysis_status: string;
  summary: string | null;
  search_text: string;
  saved_at: string;
  updated_at: string;
}

export interface HydratedVideo {
  id: string;
  user_id: string;
  source_url: string;
  normalized_url: string;
  platform: string;
  platform_video_id: string | null;
  content_type: string | null;
  title: string | null;
  description: string | null;
  caption: string | null;
  hashtags: string[];
  creator_name: string | null;
  creator_handle: string | null;
  thumbnail_url: string | null;
  embed_url: string | null;
  embed_html: string | null;
  duration_seconds: number | null;
  language: string | null;
  status: string;
  metadata_status: string;
  analysis_status: string;
  summary: string | null;
  search_text: string;
  saved_at: string;
  updated_at: string;
  tags: Array<{ tag: string; source: string }>;
  collections: Array<{ id: string; name: string; type: string }>;
  analysis: Record<string, unknown> | null;
}

function toTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function serializeVideo(video: HydratedVideo): Record<string, unknown> {
  return {
    ...video,
    hashtags_json: video.hashtags,
    language_code: video.language,
  };
}

export async function hydrateVideos(
  client: PoolClient,
  baseRows: VideoBaseRow[],
): Promise<HydratedVideo[]> {
  if (baseRows.length === 0) {
    return [];
  }

  const videoIds = baseRows.map((row) => row.id);

  const [tagsResult, collectionsResult, analysisResult] = await Promise.all([
    client.query<{
      video_id: string;
      tag: string;
      source: string;
    }>(
      `select video_id, tag, source
       from public.video_tags
       where video_id = any($1::uuid[])
       order by created_at asc`,
      [videoIds],
    ),
    client.query<{
      video_id: string;
      collection_id: string;
      collection_name: string;
      collection_type: string;
    }>(
      `select cv.video_id, c.id as collection_id, c.name as collection_name, c.type as collection_type
       from public.collection_videos cv
       join public.collections c on c.id = cv.collection_id
       where cv.video_id = any($1::uuid[])
       order by c.created_at asc`,
      [videoIds],
    ),
    client.query<Record<string, unknown> & { video_id: string }>(
      `select *
       from public.video_analysis
       where video_id = any($1::uuid[])`,
      [videoIds],
    ),
  ]);

  const tagsByVideoId = new Map<string, Array<{ tag: string; source: string }>>();
  for (const row of tagsResult.rows) {
    const existing = tagsByVideoId.get(row.video_id) ?? [];
    existing.push({ tag: row.tag, source: row.source });
    tagsByVideoId.set(row.video_id, existing);
  }

  const collectionsByVideoId = new Map<string, Array<{ id: string; name: string; type: string }>>();
  for (const row of collectionsResult.rows) {
    const existing = collectionsByVideoId.get(row.video_id) ?? [];
    existing.push({ id: row.collection_id, name: row.collection_name, type: row.collection_type });
    collectionsByVideoId.set(row.video_id, existing);
  }

  const analysisByVideoId = new Map<string, Record<string, unknown>>();
  for (const row of analysisResult.rows) {
    analysisByVideoId.set(row.video_id, row);
  }

  return baseRows.map((row) => {
    const hashtags = toTextArray(row.hashtags_json);
    const tags = tagsByVideoId.get(row.id) ?? [];
    const collections = collectionsByVideoId.get(row.id) ?? [];
    const analysis = analysisByVideoId.get(row.id) ?? null;

    return {
      ...row,
      hashtags,
      language: row.language_code,
      tags,
      collections,
      analysis,
      search_text: row.search_text || buildSearchText([
        row.title,
        row.creator_name,
        row.creator_handle,
        row.caption,
        row.description,
        hashtags.join(" "),
      ]),
    };
  });
}
