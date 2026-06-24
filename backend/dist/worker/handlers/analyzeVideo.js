import { withTransaction } from "../../lib/db.js";
import { normalizeTag } from "../../lib/video.js";
import { hydrateVideos } from "../../lib/video-records.js";
import { analyzeVideoMetadata, } from "../analyzers/videoAnalyzer.js";
import { INDEX_VIDEO_QUEUE, ANALYZE_VIDEO_QUEUE } from "../queues.js";
function toMetadataInput(video) {
    return {
        title: video.title ?? "",
        description: video.description ?? "",
        caption: video.caption ?? "",
        hashtags: video.hashtags,
        creator_name: video.creator_name ?? "",
        creator_handle: video.creator_handle ?? "",
        platform: video.platform ?? "",
        language: video.language ?? "",
    };
}
function buildSearchText(video, analysis, tags) {
    return [
        video.source_url,
        video.normalized_url,
        video.platform,
        video.title,
        video.description,
        video.caption,
        video.creator_name,
        video.creator_handle,
        analysis.topic,
        analysis.summary,
        analysis.audience,
        analysis.vertical_type,
        tags.join(" "),
    ]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim())
        .join(" ");
}
async function loadVideoForAnalysis(client, videoId) {
    const result = await client.query(`
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
    `, [videoId]);
    const hydrated = await hydrateVideos(client, result.rows);
    return hydrated[0] ?? null;
}
function toAiTags(tags) {
    const deduped = new Set();
    const normalizedTags = [];
    for (const tag of tags) {
        const normalized = normalizeTag(tag);
        if (!normalized || deduped.has(normalized)) {
            continue;
        }
        deduped.add(normalized);
        normalizedTags.push(normalized);
    }
    return normalizedTags;
}
export async function processAnalyzeVideo(videoId, deps) {
    const video = await deps.loadVideo(videoId);
    if (!video) {
        return {
            videoId,
            status: "ready",
            analysis_status: "completed",
        };
    }
    const analysis = await analyzeVideoMetadata(toMetadataInput(video));
    const tags = toAiTags(analysis.tags);
    await deps.insertVideoAnalysis(videoId, {
        ...analysis,
        tags,
    });
    await deps.insertVideoTags(videoId, tags);
    const searchText = buildSearchText(video, analysis, tags);
    await deps.updateVideoFinalStatus(videoId, analysis.summary, searchText);
    await deps.enqueueIndexVideo(videoId, video.user_id);
    return {
        videoId,
        status: "ready",
        analysis_status: "completed",
    };
}
export async function registerAnalyzeVideoHandler(boss) {
    await boss.work(ANALYZE_VIDEO_QUEUE, async (jobs) => {
        const job = jobs[0];
        if (!job) {
            return;
        }
        const { videoId } = job.data;
        await withTransaction(async (client) => {
            await processAnalyzeVideo(videoId, {
                loadVideo: async (id) => loadVideoForAnalysis(client, id),
                insertVideoAnalysis: async (id, analysis) => {
                    await client.query(`
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
            `, [
                        id,
                        analysis.topic,
                        analysis.format,
                        analysis.intent,
                        analysis.audience,
                        analysis.vertical_type,
                        analysis.quality_score,
                        JSON.stringify(analysis.tags),
                        JSON.stringify({
                            ...analysis.vertical_fields,
                            summary: analysis.summary,
                            confidence: analysis.confidence,
                        }),
                    ]);
                },
                insertVideoTags: async (id, tags) => {
                    for (const tag of tags) {
                        await client.query(`
                insert into public.video_tags (video_id, tag, source)
                values ($1, $2, 'ai')
                on conflict do nothing
              `, [id, tag]);
                    }
                },
                updateVideoFinalStatus: async (id, summary, searchText) => {
                    await client.query(`
              update public.videos
              set summary = $2,
                  status = 'ready',
                  analysis_status = 'completed',
                  search_text = $3,
                  updated_at = now()
              where id = $1
            `, [id, summary, searchText]);
                    await client.query(`
              insert into public.processing_jobs (
                video_id,
                job_type,
                status,
                attempt_count,
                queued_at
              )
              values ($1, 'index_video', 'queued', 0, now())
            `, [id]);
                },
                enqueueIndexVideo: async (id, userId) => {
                    await boss.send(INDEX_VIDEO_QUEUE, { videoId: id, userId });
                },
            });
        });
        return {
            videoId,
            status: "ready",
            analysis_status: "completed",
        };
    });
}
