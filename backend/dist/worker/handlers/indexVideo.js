import { withTransaction } from "../../lib/db.js";
import { hydrateVideos } from "../../lib/video-records.js";
import { buildSearchText } from "../../lib/video.js";
import { REFRESH_SMART_COLLECTIONS_QUEUE, INDEX_VIDEO_QUEUE } from "../queues.js";
function normalizeSearchParts(values) {
    const seen = new Set();
    const normalized = [];
    for (const value of values) {
        if (typeof value !== "string") {
            continue;
        }
        const trimmed = value.trim().toLowerCase();
        if (!trimmed || seen.has(trimmed)) {
            continue;
        }
        seen.add(trimmed);
        normalized.push(trimmed);
    }
    return normalized;
}
function getAnalysisTextParts(analysis) {
    if (!analysis || typeof analysis !== "object") {
        return { topic: null, category: null, summary: null };
    }
    const record = analysis;
    const verticalFields = record.vertical_fields_json;
    const readString = (value) => (typeof value === "string" ? value : null);
    const readNestedString = (value, key) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return null;
        }
        return readString(value[key]);
    };
    return {
        topic: readString(record.topic),
        category: readNestedString(verticalFields, "category"),
        summary: readNestedString(verticalFields, "summary"),
    };
}
export function buildIndexedSearchText(video) {
    const analysisParts = getAnalysisTextParts(video.analysis);
    const tagNames = video.tags.map((tag) => tag.tag);
    const collectionNames = video.collections.map((collection) => collection.name);
    const values = normalizeSearchParts([
        video.title,
        video.description,
        video.caption,
        video.creator_name,
        video.creator_handle,
        video.platform,
        video.language,
        ...tagNames,
        analysisParts.topic,
        analysisParts.category,
        analysisParts.summary,
        ...collectionNames,
    ]);
    return buildSearchText(values);
}
export async function processIndexVideo(videoId, deps) {
    const video = await deps.loadVideo(videoId);
    if (!video) {
        throw new Error(`Video ${videoId} not found`);
    }
    const searchText = buildIndexedSearchText(video);
    await deps.updateVideoSearchText(videoId, searchText);
    await deps.enqueueRefreshSmartCollections(videoId);
    return searchText;
}
async function loadVideoForIndex(client, videoId) {
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
async function updateVideoSearchText(client, videoId, searchText) {
    await client.query(`
      update public.videos
      set search_text = $2,
          updated_at = now()
      where id = $1
    `, [videoId, searchText]);
}
export async function registerIndexVideoHandler(boss) {
    await boss.work(INDEX_VIDEO_QUEUE, async (jobs) => {
        const job = jobs[0];
        if (!job) {
            return;
        }
        const { videoId } = job.data;
        await withTransaction(async (client) => {
            await processIndexVideo(videoId, {
                loadVideo: async (id) => loadVideoForIndex(client, id),
                updateVideoSearchText: async (id, searchText) => updateVideoSearchText(client, id, searchText),
                enqueueRefreshSmartCollections: async (id) => {
                    await client.query(`
              insert into public.processing_jobs (
                video_id,
                job_type,
                status,
                attempt_count,
                queued_at
              )
              values ($1, 'refresh_smart_collections', 'queued', 0, now())
            `, [id]);
                },
            });
        });
        await boss.send(REFRESH_SMART_COLLECTIONS_QUEUE, { videoId });
    });
}
