import { withTransaction } from "../../lib/db.js";
import { hydrateVideos } from "../../lib/video-records.js";
import { REFRESH_SMART_COLLECTIONS_QUEUE } from "../queues.js";
function normalizeText(value) {
    return value.trim().toLowerCase();
}
function toRuleArray(rules) {
    if (!Array.isArray(rules)) {
        return [];
    }
    return rules.filter((rule) => typeof rule === "object" && rule !== null);
}
function getAnalysisFields(analysis) {
    if (!analysis || typeof analysis !== "object") {
        return { topic: null, category: null };
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
    };
}
export function evaluateSmartCollectionRule(rule, video) {
    if (!rule.type || typeof rule.value !== "string") {
        return false;
    }
    const value = normalizeText(rule.value);
    if (!value) {
        return false;
    }
    const analysisFields = getAnalysisFields(video.analysis);
    switch (rule.type) {
        case "tag_contains":
            return video.tags.some((tag) => normalizeText(tag.tag).includes(value));
        case "topic_equals":
            return analysisFields.topic ? normalizeText(analysisFields.topic) === value : false;
        case "creator_equals":
            return video.creator_name ? normalizeText(video.creator_name) === value : false;
        case "platform_equals":
            return normalizeText(video.platform) === value;
        default:
            return false;
    }
}
export function evaluateSmartCollectionRules(rulesJson, video) {
    const rules = toRuleArray(rulesJson);
    if (rules.length === 0) {
        return false;
    }
    return rules.some((rule) => evaluateSmartCollectionRule(rule, video));
}
export async function processRefreshSmartCollections(videoId, deps) {
    const video = await deps.loadVideo(videoId);
    if (!video) {
        throw new Error(`Video ${videoId} not found`);
    }
    const smartCollections = await deps.listSmartCollections(video.user_id);
    for (const collection of smartCollections) {
        const matches = evaluateSmartCollectionRules(collection.rules_json, video);
        const hasMembership = await deps.hasMembership(collection.id, videoId);
        if (matches) {
            await deps.addMembership(collection.id, videoId);
            continue;
        }
        if (hasMembership) {
            await deps.removeMembership(collection.id, videoId);
        }
    }
}
async function loadVideoForRefresh(client, videoId) {
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
async function listSmartCollections(client, userId) {
    return client.query(`
      select id, user_id, rules_json
      from public.collections
      where user_id = $1 and type = 'smart'
    `, [userId]).then((result) => result.rows);
}
async function hasMembership(client, collectionId, videoId) {
    const result = await client.query(`
      select exists (
        select 1
        from public.collection_videos
        where collection_id = $1 and video_id = $2
      ) as exists
    `, [collectionId, videoId]);
    return result.rows[0]?.exists ?? false;
}
async function addMembership(client, collectionId, videoId) {
    await client.query(`
      insert into public.collection_videos (collection_id, video_id)
      values ($1, $2)
      on conflict do nothing
    `, [collectionId, videoId]);
}
async function removeMembership(client, collectionId, videoId) {
    await client.query(`
      delete from public.collection_videos
      where collection_id = $1 and video_id = $2
    `, [collectionId, videoId]);
}
export async function registerRefreshSmartCollectionsHandler(boss) {
    await boss.work(REFRESH_SMART_COLLECTIONS_QUEUE, async (jobs) => {
        const job = jobs[0];
        if (!job) {
            return;
        }
        const { videoId } = job.data;
        await withTransaction(async (client) => {
            await processRefreshSmartCollections(videoId, {
                loadVideo: async (id) => loadVideoForRefresh(client, id),
                listSmartCollections: async (userId) => listSmartCollections(client, userId),
                hasMembership: async (collectionId, id) => hasMembership(client, collectionId, id),
                addMembership: async (collectionId, id) => addMembership(client, collectionId, id),
                removeMembership: async (collectionId, id) => removeMembership(client, collectionId, id),
            });
            await client.query(`
          update public.processing_jobs
          set status = 'succeeded',
              completed_at = now(),
              updated_at = now()
          where video_id = $1 and job_type = 'refresh_smart_collections'
        `, [videoId]);
        });
    });
}
