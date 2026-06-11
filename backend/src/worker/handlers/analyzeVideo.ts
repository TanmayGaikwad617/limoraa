import type { PoolClient } from "pg";
import type { PgBoss } from "pg-boss";
import { withTransaction } from "../../lib/db.js";
import { normalizeTag } from "../../lib/video.js";
import { hydrateVideos, type HydratedVideo, type VideoBaseRow } from "../../lib/video-records.js";
import { INDEX_VIDEO_QUEUE, ANALYZE_VIDEO_QUEUE } from "../queues.js";

type AnalyzeVideoJob = {
  videoId: string;
};

type StubAnalysis = {
  topic: string;
  category: string;
  summary: string;
  confidence: number;
};

type LoadedVideo = Pick<
  HydratedVideo,
  | "id"
  | "user_id"
  | "source_url"
  | "normalized_url"
  | "platform"
  | "platform_video_id"
  | "title"
  | "description"
  | "creator_name"
  | "creator_handle"
  | "hashtags"
  | "language"
>;

const STUB_TAGS = ["AI", "Technology", "Productivity", "Education"];

function buildStubAnalysis(): StubAnalysis {
  return {
    topic: "AI",
    category: "Technology",
    summary: "Stub summary",
    confidence: 0.95,
  };
}

function buildSearchText(video: LoadedVideo, analysis: StubAnalysis, tags: string[]): string {
  return [
    video.source_url,
    video.normalized_url,
    video.platform,
    video.title,
    video.description,
    video.creator_name,
    video.creator_handle,
    analysis.topic,
    analysis.category,
    analysis.summary,
    tags.join(" "),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .join(" ");
}

async function loadVideoForAnalysis(client: PoolClient, videoId: string): Promise<LoadedVideo | null> {
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

function toAiTags(): string[] {
  return STUB_TAGS.map(normalizeTag).filter(Boolean);
}

export async function registerAnalyzeVideoHandler(boss: PgBoss): Promise<void> {
  await boss.work<AnalyzeVideoJob>(ANALYZE_VIDEO_QUEUE, async (jobs) => {
    const job = jobs[0];
    if (!job) {
      return;
    }

    const { videoId } = job.data;
    const analysis = buildStubAnalysis();
    const tags = toAiTags();

    const video = await withTransaction(async (client) => {
      const loaded = await loadVideoForAnalysis(client, videoId);
      if (!loaded) {
        throw new Error(`Video ${videoId} not found`);
      }

      await client.query(
        `
          update public.videos
          set status = 'analyzing',
              analysis_status = 'processing',
              updated_at = now()
          where id = $1
        `,
        [videoId],
      );

      await client.query(
        `
          insert into public.video_analysis (
            video_id,
            topic,
            format,
            intent,
            audience,
            vertical_type,
            quality_score,
            tags_json,
            vertical_fields_json,
            analysis_version
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8::jsonb,
            $9::jsonb,
            1
          )
          on conflict (video_id) do update set
            topic = excluded.topic,
            format = excluded.format,
            intent = excluded.intent,
            audience = excluded.audience,
            vertical_type = excluded.vertical_type,
            quality_score = excluded.quality_score,
            tags_json = excluded.tags_json,
            vertical_fields_json = excluded.vertical_fields_json,
            analysis_version = public.video_analysis.analysis_version + 1
        `,
        [
          videoId,
          analysis.topic,
          "Stub",
          "classification",
          "General",
          null,
          analysis.confidence,
          JSON.stringify(tags),
          JSON.stringify({
            category: analysis.category,
            summary: analysis.summary,
            confidence: analysis.confidence,
          }),
        ],
      );

      for (const tag of tags) {
        await client.query(
          `
            insert into public.video_tags (video_id, tag, source)
            values ($1, $2, 'ai')
            on conflict do nothing
          `,
          [videoId, tag],
        );
      }

      const searchText = buildSearchText(loaded, analysis, tags);

      await client.query(
        `
          update public.videos
          set summary = $2,
              status = 'completed',
              analysis_status = 'completed',
              search_text = $3,
              updated_at = now()
          where id = $1
        `,
        [videoId, analysis.summary, searchText],
      );

      return loaded;
    });

      await boss.send(INDEX_VIDEO_QUEUE, {
        videoId,
        userId: video.user_id,
      });

    return {
      videoId,
      status: "completed",
    };
  });
}
