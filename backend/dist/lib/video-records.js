import { buildSearchText } from "./video.js";
function toTextArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => typeof item === "string");
}
export function serializeVideo(video) {
    return {
        ...video,
        hashtags_json: video.hashtags,
        language_code: video.language,
    };
}
export async function hydrateVideos(client, baseRows) {
    if (baseRows.length === 0) {
        return [];
    }
    const videoIds = baseRows.map((row) => row.id);
    const tagsResult = await client.query(`select video_id, tag, source
     from public.video_tags
     where video_id = any($1::uuid[])
     order by created_at asc`, [videoIds]);
    const collectionsResult = await client.query(`select cv.video_id, c.id as collection_id, c.name as collection_name, c.type as collection_type
     from public.collection_videos cv
     join public.collections c on c.id = cv.collection_id
     where cv.video_id = any($1::uuid[])
     order by c.created_at asc`, [videoIds]);
    const analysisResult = await client.query(`select
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
     from public.video_analysis
     where video_id = any($1::uuid[])`, [videoIds]);
    const tagsByVideoId = new Map();
    for (const row of tagsResult.rows) {
        const existing = tagsByVideoId.get(row.video_id) ?? [];
        existing.push({ tag: row.tag, source: row.source });
        tagsByVideoId.set(row.video_id, existing);
    }
    const collectionsByVideoId = new Map();
    for (const row of collectionsResult.rows) {
        const existing = collectionsByVideoId.get(row.video_id) ?? [];
        existing.push({ id: row.collection_id, name: row.collection_name, type: row.collection_type });
        collectionsByVideoId.set(row.video_id, existing);
    }
    const analysisByVideoId = new Map();
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
