export const FETCH_METADATA_QUEUE = "fetch_metadata";
export const ANALYZE_VIDEO_QUEUE = "analyze_video";
export const INDEX_VIDEO_QUEUE = "index_video";
export const REFRESH_SMART_COLLECTIONS_QUEUE = "refresh_smart_collections";
export async function ensureWorkerQueues(boss) {
    await Promise.all([
        boss.createQueue(FETCH_METADATA_QUEUE),
        boss.createQueue(ANALYZE_VIDEO_QUEUE),
        boss.createQueue(INDEX_VIDEO_QUEUE),
        boss.createQueue(REFRESH_SMART_COLLECTIONS_QUEUE),
    ]);
}
