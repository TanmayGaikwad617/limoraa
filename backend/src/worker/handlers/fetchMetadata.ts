import type { PgBoss } from "pg-boss";
import { buildSearchText, type SupportedPlatform } from "../../lib/video.js";
import type { PoolClient } from "pg";
import { withTransaction } from "../../lib/db.js";
import { hydrateVideos, type HydratedVideo, type VideoBaseRow } from "../../lib/video-records.js";
import { ANALYZE_VIDEO_QUEUE, FETCH_METADATA_QUEUE } from "../queues.js";

type FetchMetadataJob = {
  videoId: string;
};

type StubMetadata = {
  title: string;
  description: string;
  creator_name: string;
  creator_handle: string;
  thumbnail_url: string;
  embed_url: string;
  hashtags: string[];
  language: string;
};

type LoadedVideo = Pick<
  HydratedVideo,
  | "id"
  | "source_url"
  | "normalized_url"
  | "platform"
  | "platform_video_id"
  | "title"
  | "description"
  | "creator_name"
  | "creator_handle"
  | "thumbnail_url"
  | "embed_url"
  | "hashtags"
  | "language"
>;

function assertSupportedPlatform(platform: string): SupportedPlatform {
  if (platform === "youtube" || platform === "instagram" || platform === "tiktok") {
    return platform;
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

function buildStubMetadata(video: LoadedVideo): StubMetadata {
  const platform = assertSupportedPlatform(video.platform);
  const platformVideoId = video.platform_video_id ?? video.id;
  const handleSuffix = platformVideoId.slice(0, 8).toLowerCase();

  const parsers: Record<SupportedPlatform, () => StubMetadata> = {
    youtube: () => ({
      title: `Stub YouTube title for ${platformVideoId}`,
      description: `Stub YouTube description for ${platformVideoId}.`,
      creator_name: "YouTube Creator",
      creator_handle: `@youtube_${handleSuffix}`,
      thumbnail_url: `https://placehold.co/640x360/png?text=YouTube+${encodeURIComponent(handleSuffix)}`,
      embed_url: `https://www.youtube.com/embed/${platformVideoId}`,
      hashtags: ["youtube", "stub", "metadata"],
      language: "en",
    }),
    instagram: () => ({
      title: `Stub Instagram title for ${platformVideoId}`,
      description: `Stub Instagram description for ${platformVideoId}.`,
      creator_name: "Instagram Creator",
      creator_handle: `@instagram_${handleSuffix}`,
      thumbnail_url: `https://placehold.co/640x360/png?text=Instagram+${encodeURIComponent(handleSuffix)}`,
      embed_url: `https://www.instagram.com/reel/${platformVideoId}/embed/`,
      hashtags: ["instagram", "stub", "metadata"],
      language: "en",
    }),
    tiktok: () => ({
      title: `Stub TikTok title for ${platformVideoId}`,
      description: `Stub TikTok description for ${platformVideoId}.`,
      creator_name: "TikTok Creator",
      creator_handle: `@tiktok_${handleSuffix}`,
      thumbnail_url: `https://placehold.co/640x360/png?text=TikTok+${encodeURIComponent(handleSuffix)}`,
      embed_url: `https://www.tiktok.com/embed/v2/${platformVideoId}`,
      hashtags: ["tiktok", "stub", "metadata"],
      language: "en",
    }),
  };

  return parsers[platform]();
}

async function loadVideoForMetadata(client: PoolClient, videoId: string): Promise<LoadedVideo | null> {
  const result = await client.query<VideoBaseRow>(
    `
      select
        id,
        user_id,
        source_url,
        normalized_url,
        platform,
        platform_video_id,
        content_type,
        title,
        description,
        caption,
        hashtags_json,
        creator_name,
        creator_handle,
        thumbnail_url,
        embed_url,
        embed_html,
        duration_seconds,
        language_code,
        status,
        metadata_status,
        analysis_status,
        summary,
        search_text,
        saved_at,
        updated_at
      from public.videos
      where id = $1
      limit 1
    `,
    [videoId],
  );

  const hydrated = await hydrateVideos(client, result.rows);
  return hydrated[0] ?? null;
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to process fetch_metadata job";
}

export async function registerFetchMetadataHandler(boss: PgBoss): Promise<void> {
  await boss.work<FetchMetadataJob>(FETCH_METADATA_QUEUE, async (jobs) => {
    const job = jobs[0];
    if (!job) {
      return;
    }

    const { videoId } = job.data;

    try {
      const metadata = await withTransaction(async (client) => {
        const video = await loadVideoForMetadata(client, videoId);
        if (!video) {
          throw new Error(`Video ${videoId} not found`);
        }

        await client.query(
          `
            update public.processing_jobs
            set status = 'running',
                started_at = coalesce(started_at, now()),
                updated_at = now()
            where video_id = $1 and job_type = 'fetch_metadata'
          `,
          [videoId],
        );

        await client.query(
          `
            update public.videos
            set status = 'fetching_metadata',
                metadata_status = 'processing',
                updated_at = now()
            where id = $1
          `,
          [videoId],
        );

        const stubMetadata = buildStubMetadata(video);
        const searchText = buildSearchText([
          video.source_url,
          video.normalized_url,
          video.platform,
          stubMetadata.title,
          stubMetadata.description,
          stubMetadata.creator_name,
          stubMetadata.creator_handle,
          stubMetadata.hashtags.join(" "),
        ]);

        await client.query(
          `
            update public.videos
            set title = $2,
                description = $3,
                creator_name = $4,
                creator_handle = $5,
                thumbnail_url = $6,
                embed_url = $7,
                hashtags_json = $8::jsonb,
                language_code = $9,
                status = 'analyzing',
                metadata_status = 'completed',
                analysis_status = 'queued',
                search_text = $10,
                updated_at = now()
            where id = $1
          `,
          [
            videoId,
            stubMetadata.title,
            stubMetadata.description,
            stubMetadata.creator_name,
            stubMetadata.creator_handle,
            stubMetadata.thumbnail_url,
            stubMetadata.embed_url,
            JSON.stringify(stubMetadata.hashtags),
            stubMetadata.language,
            searchText,
          ],
        );

        return stubMetadata;
      });

      await boss.send(ANALYZE_VIDEO_QUEUE, { videoId });

      await withTransaction(async (client) => {
        await client.query(
          `
            update public.processing_jobs
            set status = 'succeeded',
                completed_at = now(),
                updated_at = now()
            where video_id = $1 and job_type = 'fetch_metadata'
          `,
          [videoId],
        );
      });

      return metadata;
    } catch (error) {
      const errorMessage = formatErrorMessage(error);

      await withTransaction(async (client) => {
        await client.query(
          `
            update public.videos
            set status = 'failed',
                metadata_status = 'failed',
                updated_at = now()
            where id = $1
          `,
          [videoId],
        );

        await client.query(
          `
            update public.processing_jobs
            set status = 'failed',
                error_message = $2,
                completed_at = now(),
                updated_at = now()
            where video_id = $1 and job_type = 'fetch_metadata'
          `,
          [videoId, errorMessage],
        );
      });

      throw error;
    }
  });
}
