import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { withRlsUser } from "../lib/db.js";
import { requireAuth } from "../lib/request.js";
import { getBoss } from "../lib/pgboss.js";
import { hydrateVideos } from "../lib/video-records.js";
const CollectionBodySchema = z.object({
    name: z.string().min(1).max(120),
    description: z.string().min(1).optional().nullable(),
    type: z.enum(["manual", "smart"]).default("manual"),
    icon: z.string().min(1).optional().nullable(),
    rules_json: z.array(z.record(z.string(), z.any())).default([]),
    sort_order: z.coerce.number().int().default(0),
});
const CollectionPatchSchema = CollectionBodySchema.partial();
const CollectionIdParamsSchema = z.object({
    id: z.string().uuid(),
});
const CollectionVideoBodySchema = z.object({
    video_id: z.string().uuid().optional(),
    videoId: z.string().uuid().optional(),
});
function buildVideoSelect(whereClause) {
    return `
    select
      v.id,
      v.user_id,
      v.source_url,
      v.normalized_url,
      v.platform,
      v.platform_video_id,
      v.content_type,
      v.title,
      v.description,
      v.caption,
      v.hashtags_json,
      v.creator_name,
      v.creator_handle,
      v.thumbnail_url,
      v.embed_url,
      v.embed_html,
      v.duration_seconds,
      v.language_code,
      v.status,
      v.metadata_status,
      v.analysis_status,
      v.summary,
      v.search_text,
      v.saved_at,
      v.updated_at
    from public.videos v
    ${whereClause}
    order by v.saved_at desc
  `;
}
async function loadCollectionVideos(client, userId, collectionId) {
    const result = await client.query(buildVideoSelect(`
        join public.collection_videos cv on cv.video_id = v.id
        where cv.collection_id = $1 and v.user_id = $2
      `), [collectionId, userId]);
    return hydrateVideos(client, result.rows);
}
async function reindexCollectionVideos(client, userId, collectionId) {
    const result = await client.query(`
      select video_id
      from public.collection_videos
      where collection_id = $1
    `, [collectionId]);
    for (const row of result.rows) {
        await client.query(`
        insert into public.processing_jobs (video_id, job_type, status, attempt_count, queued_at)
        values ($1, 'index_video', 'queued', 0, now())
      `, [row.video_id]);
        await getBoss().send("index_video", { videoId: row.video_id, userId });
    }
}
async function loadCollectionDetail(client, userId, collectionId) {
    const collectionResult = await client.query(`
      select
        id,
        user_id,
        name,
        description,
        type,
        icon,
        rules_json,
        sort_order,
        created_at,
        updated_at
      from public.collections
      where id = $1 and user_id = $2
    `, [collectionId, userId]);
    const collection = collectionResult.rows[0];
    if (!collection) {
        return null;
    }
    const videos = await loadCollectionVideos(client, userId, collectionId);
    return {
        ...collection,
        videos,
    };
}
export const collectionRoutes = async (app) => {
    app.addHook("preHandler", app.authenticate);
    app.get("/collections", async (request) => {
        const auth = requireAuth(request);
        return withRlsUser(auth.user, async (client) => {
            const result = await client.query(`
          select
            c.id,
            c.user_id,
            c.name,
            c.description,
            c.type,
            c.icon,
            c.rules_json,
            c.sort_order,
            c.created_at,
            c.updated_at,
            count(cv.video_id)::int as item_count
          from public.collections c
          left join public.collection_videos cv on cv.collection_id = c.id
          where c.user_id = $1
          group by c.id
          order by c.sort_order asc, c.created_at desc
        `, [auth.user.id]);
            return {
                items: result.rows,
            };
        });
    });
    app.post("/collections", async (request) => {
        const auth = requireAuth(request);
        const body = CollectionBodySchema.parse(request.body ?? {});
        return withRlsUser(auth.user, async (client) => {
            const result = await client.query(`
          insert into public.collections (
            user_id,
            name,
            description,
            type,
            icon,
            rules_json,
            sort_order
          )
          values ($1, $2, $3, $4, $5, $6::jsonb, $7)
          returning
            id,
            user_id,
            name,
            description,
            type,
            icon,
            rules_json,
            sort_order,
            created_at,
            updated_at
        `, [
                auth.user.id,
                body.name,
                body.description ?? null,
                body.type,
                body.icon ?? null,
                JSON.stringify(body.rules_json),
                body.sort_order,
            ]);
            return {
                collection: result.rows[0],
            };
        });
    });
    app.get("/collections/:id", async (request) => {
        const auth = requireAuth(request);
        const params = CollectionIdParamsSchema.parse(request.params ?? {});
        return withRlsUser(auth.user, async (client) => {
            const collection = await loadCollectionDetail(client, auth.user.id, params.id);
            if (!collection) {
                throw new AppError(404, "collection_not_found", "Collection not found");
            }
            return { collection };
        });
    });
    app.patch("/collections/:id", async (request) => {
        const auth = requireAuth(request);
        const params = CollectionIdParamsSchema.parse(request.params ?? {});
        const body = CollectionPatchSchema.parse(request.body ?? {});
        return withRlsUser(auth.user, async (client) => {
            const existing = await loadCollectionDetail(client, auth.user.id, params.id);
            if (!existing) {
                throw new AppError(404, "collection_not_found", "Collection not found");
            }
            const result = await client.query(`
          update public.collections
          set
            name = coalesce($2, name),
            description = coalesce($3, description),
            type = coalesce($4, type),
            icon = coalesce($5, icon),
            rules_json = coalesce($6::jsonb, rules_json),
            sort_order = coalesce($7, sort_order),
            updated_at = now()
          where id = $1 and user_id = $8
          returning
            id,
            user_id,
            name,
            description,
            type,
            icon,
            rules_json,
            sort_order,
            created_at,
            updated_at
        `, [
                params.id,
                body.name ?? null,
                body.description ?? null,
                body.type ?? null,
                body.icon ?? null,
                body.rules_json !== undefined ? JSON.stringify(body.rules_json) : null,
                body.sort_order ?? null,
                auth.user.id,
            ]);
            if (body.name !== undefined ||
                body.description !== undefined ||
                body.type !== undefined ||
                body.icon !== undefined ||
                body.rules_json !== undefined ||
                body.sort_order !== undefined) {
                await reindexCollectionVideos(client, auth.user.id, params.id);
            }
            return {
                collection: result.rows[0],
            };
        });
    });
    app.delete("/collections/:id", async (request) => {
        const auth = requireAuth(request);
        const params = CollectionIdParamsSchema.parse(request.params ?? {});
        return withRlsUser(auth.user, async (client) => {
            const existing = await loadCollectionDetail(client, auth.user.id, params.id);
            if (!existing) {
                throw new AppError(404, "collection_not_found", "Collection not found");
            }
            const affectedVideoIds = existing.videos.map((video) => video.id);
            await client.query("delete from public.collections where id = $1 and user_id = $2", [
                params.id,
                auth.user.id,
            ]);
            for (const videoId of affectedVideoIds) {
                await client.query(`
            insert into public.processing_jobs (video_id, job_type, status, attempt_count, queued_at)
            values ($1, 'index_video', 'queued', 0, now())
          `, [videoId]);
                await getBoss().send("index_video", { videoId, userId: auth.user.id });
            }
            return { ok: true };
        });
    });
    app.post("/collections/:id/videos", async (request) => {
        const auth = requireAuth(request);
        const params = CollectionIdParamsSchema.parse(request.params ?? {});
        const body = CollectionVideoBodySchema.parse(request.body ?? {});
        const videoId = body.video_id ?? body.videoId;
        if (!videoId) {
            throw new AppError(400, "invalid_request", "video_id is required");
        }
        return withRlsUser(auth.user, async (client) => {
            const collection = await loadCollectionDetail(client, auth.user.id, params.id);
            if (!collection) {
                throw new AppError(404, "collection_not_found", "Collection not found");
            }
            const videoResult = await client.query(`select id from public.videos where id = $1 and user_id = $2`, [videoId, auth.user.id]);
            if (!videoResult.rows[0]) {
                throw new AppError(404, "video_not_found", "Video not found");
            }
            await client.query(`
          insert into public.collection_videos (collection_id, video_id)
          values ($1, $2)
          on conflict do nothing
        `, [params.id, videoId]);
            await client.query(`
          insert into public.processing_jobs (video_id, job_type, status, attempt_count, queued_at)
          values ($1, 'index_video', 'queued', 0, now())
        `, [videoId]);
            await getBoss().send("index_video", { videoId, userId: auth.user.id });
            return { ok: true };
        });
    });
    app.delete("/collections/:id/videos/:videoId", async (request) => {
        const auth = requireAuth(request);
        const params = z
            .object({
            id: z.string().uuid(),
            videoId: z.string().uuid(),
        })
            .parse(request.params ?? {});
        return withRlsUser(auth.user, async (client) => {
            const collection = await loadCollectionDetail(client, auth.user.id, params.id);
            if (!collection) {
                throw new AppError(404, "collection_not_found", "Collection not found");
            }
            await client.query(`
          delete from public.collection_videos
          where collection_id = $1 and video_id = $2
        `, [params.id, params.videoId]);
            await client.query(`
          insert into public.processing_jobs (video_id, job_type, status, attempt_count, queued_at)
          values ($1, 'index_video', 'queued', 0, now())
        `, [params.videoId]);
            await getBoss().send("index_video", { videoId: params.videoId, userId: auth.user.id });
            return { ok: true };
        });
    });
};
