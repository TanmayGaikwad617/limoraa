import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { withRlsUser } from "../lib/db.js";
import { requireAuth } from "../lib/request.js";
import { getBoss } from "../lib/pgboss.js";
import { buildSearchText, normalizeVideoUrl } from "../lib/video.js";
import { hydrateVideos } from "../lib/video-records.js";
const SaveSchema = z.object({
    url: z.string().min(1),
});
const BulkSaveSchema = z.object({
    urls: z.array(z.string().min(1)).min(1).max(50),
});
export const PaginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
    platform: z.enum(["tiktok", "instagram", "youtube"]).optional(),
    content_type: z
        .enum([
        "recipe",
        "workout",
        "tutorial_diy",
        "beauty_fashion",
        "education",
        "entertainment",
        "general",
    ])
        .optional(),
    language: z.string().min(1).optional(),
    creator: z.string().min(1).optional(),
    collection_id: z.string().uuid().optional(),
    status: z.enum(["queued", "fetching_metadata", "analyzing", "ready", "failed"]).optional(),
    q: z.string().min(1).optional(),
});
const PatchSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().min(1).optional(),
    caption: z.string().min(1).optional(),
    hashtags: z.array(z.string().min(1)).optional(),
    creator_name: z.string().min(1).optional(),
    creator_handle: z.string().min(1).optional(),
    thumbnail_url: z.string().url().nullable().optional(),
    embed_url: z.string().url().nullable().optional(),
    embed_html: z.string().min(1).nullable().optional(),
    duration_seconds: z.number().int().min(0).nullable().optional(),
    language_code: z.string().min(1).nullable().optional(),
    content_type: z
        .enum([
        "recipe",
        "workout",
        "tutorial_diy",
        "beauty_fashion",
        "education",
        "entertainment",
        "general",
    ])
        .nullable()
        .optional(),
    summary: z.string().min(1).nullable().optional(),
});
const IdParamsSchema = z.object({
    id: z.string().uuid(),
});
function normalizeHashtags(hashtags) {
    return hashtags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.replace(/^#/, "").toLowerCase());
}
function buildVideoSelect(whereClause, orderClause) {
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
    ${orderClause}
  `;
}
export async function loadVideoById(client, videoId) {
    const result = await client.query(buildVideoSelect("where v.id = $1", "limit 1"), [videoId]);
    const hydrated = await hydrateVideos(client, result.rows);
    return hydrated[0] ?? null;
}
export async function loadVideos(client, userId, query) {
    const values = [userId];
    const clauses = ["v.user_id = $1"];
    let index = 2;
    let searchParamIndex = null;
    if (query.platform) {
        clauses.push(`v.platform = $${index}`);
        values.push(query.platform);
        index += 1;
    }
    if (query.content_type) {
        clauses.push(`v.content_type = $${index}`);
        values.push(query.content_type);
        index += 1;
    }
    if (query.language) {
        clauses.push(`v.language_code = $${index}`);
        values.push(query.language);
        index += 1;
    }
    if (query.creator) {
        clauses.push(`(lower(coalesce(v.creator_name, '')) like lower($${index}) or lower(coalesce(v.creator_handle, '')) like lower($${index}))`);
        values.push(`%${query.creator}%`);
        index += 1;
    }
    if (query.status) {
        clauses.push(`v.status = $${index}`);
        values.push(query.status);
        index += 1;
    }
    if (query.collection_id) {
        clauses.push(`exists (
        select 1
        from public.collection_videos cv
        where cv.video_id = v.id and cv.collection_id = $${index}
      )`);
        values.push(query.collection_id);
        index += 1;
    }
    if (query.q) {
        searchParamIndex = index;
        clauses.push(`(
        to_tsvector('english', coalesce(v.search_text, '')) @@ websearch_to_tsquery('english', $${searchParamIndex})
        or lower(coalesce(v.title, '')) like lower(concat('%', $${searchParamIndex}, '%'))
        or lower(coalesce(v.creator_name, '')) like lower(concat('%', $${searchParamIndex}, '%'))
        or lower(coalesce(v.creator_handle, '')) like lower(concat('%', $${searchParamIndex}, '%'))
      )`);
        values.push(query.q);
        index += 1;
    }
    values.push(query.limit, query.offset);
    const orderClause = query.q && searchParamIndex
        ? `order by ts_rank(to_tsvector('english', coalesce(v.search_text, '')), websearch_to_tsquery('english', $${searchParamIndex})) desc, v.saved_at desc limit $${index} offset $${index + 1}`
        : `order by v.saved_at desc limit $${index} offset $${index + 1}`;
    const sql = buildVideoSelect(`where ${clauses.join(" and ")}`, orderClause);
    const result = await client.query(sql, values);
    return hydrateVideos(client, result.rows);
}
async function insertSaveUsage(client, userId, videoId, metadata) {
    await client.query(`
      insert into public.usage_events (
        user_id,
        event_type,
        resource_type,
        resource_id,
        quantity,
        metadata
      )
      values ($1, 'save', 'video', $2, 1, $3::jsonb)
    `, [userId, videoId, JSON.stringify(metadata)]);
}
async function saveVideoForUser(userId, rawUrl) {
    const normalized = normalizeVideoUrl(rawUrl);
    const saved = await withRlsUser({ id: userId }, async (client) => {
        const existingResult = await client.query(buildVideoSelect("where v.normalized_url = $1", "limit 1"), [normalized.canonical]);
        if (existingResult.rows[0]) {
            const existing = await hydrateVideos(client, existingResult.rows);
            return {
                is_new: false,
                video: existing[0] ?? null,
            };
        }
        const insertResult = await client.query(`
        insert into public.videos (
          user_id,
          source_url,
          normalized_url,
          platform,
          platform_video_id,
          status,
          metadata_status,
          analysis_status,
          search_text
        )
        values ($1, $2, $3, $4, $5, 'queued', 'queued', 'queued', $6)
        returning
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
      `, [
            userId,
            rawUrl,
            normalized.canonical,
            normalized.platform,
            normalized.platformVideoId,
            buildSearchText([rawUrl, normalized.canonical, normalized.platform]),
        ]);
        const video = insertResult.rows[0];
        if (!video) {
            throw new AppError(500, "insert_failed", "Failed to create video");
        }
        await client.query(`
        insert into public.processing_jobs (
          video_id,
          job_type,
          status,
          attempt_count,
          queued_at
        )
        values ($1, 'fetch_metadata', 'queued', 0, now())
      `, [video.id]);
        await insertSaveUsage(client, userId, video.id, {
            source_url: rawUrl,
            normalized_url: normalized.canonical,
        });
        const hydrated = await hydrateVideos(client, [video]);
        return {
            is_new: true,
            video: hydrated[0] ?? null,
        };
    });
    if (saved.is_new && saved.video) {
        const videoId = saved.video.id;
        try {
            await getBoss().send("fetch_metadata", {
                videoId,
                userId,
            });
            return {
                ...saved,
                queue_enqueued: true,
            };
        }
        catch (error) {
            await withRlsUser({ id: userId }, async (client) => {
                await client.query(`
            update public.videos
            set status = 'failed', metadata_status = 'failed', updated_at = now()
            where id = $1 and user_id = $2
          `, [videoId, userId]);
                await client.query(`
            update public.processing_jobs
            set status = 'failed', error_message = $2, completed_at = now(), updated_at = now()
            where video_id = $1 and job_type = 'fetch_metadata'
          `, [videoId, error instanceof Error ? error.message : "Failed to queue job"]);
            });
            return {
                ...saved,
                queue_enqueued: false,
                queue_error: error instanceof Error ? error.message : "Failed to queue job",
            };
        }
    }
    return {
        ...saved,
        queue_enqueued: false,
    };
}
async function enqueueIndexJob(userId, videoId) {
    await getBoss().send("index_video", {
        videoId,
        userId,
    });
}
export const videoRoutes = async (app) => {
    app.addHook("preHandler", app.authenticate);
    app.post("/videos/save", async (request) => {
        const auth = requireAuth(request);
        const body = SaveSchema.parse(request.body ?? {});
        return saveVideoForUser(auth.user.id, body.url);
    });
    app.post("/videos/bulk-save", async (request) => {
        const auth = requireAuth(request);
        const body = BulkSaveSchema.parse(request.body ?? {});
        const items = [];
        for (const url of body.urls) {
            items.push(await saveVideoForUser(auth.user.id, url));
        }
        return { items };
    });
    app.get("/videos", async (request) => {
        const auth = requireAuth(request);
        const query = PaginationSchema.parse(request.query ?? {});
        return withRlsUser(auth.user, async (client) => {
            const videos = await loadVideos(client, auth.user.id, query);
            return {
                items: videos,
                limit: query.limit,
                offset: query.offset,
            };
        });
    });
    app.get("/videos/:id", async (request) => {
        const auth = requireAuth(request);
        const params = IdParamsSchema.parse(request.params ?? {});
        return withRlsUser(auth.user, async (client) => {
            const video = await loadVideoById(client, params.id);
            if (!video) {
                throw new AppError(404, "video_not_found", "Video not found");
            }
            return { video };
        });
    });
    app.get("/videos/:id/status", async (request) => {
        const auth = requireAuth(request);
        const params = IdParamsSchema.parse(request.params ?? {});
        return withRlsUser(auth.user, async (client) => {
            const video = await loadVideoById(client, params.id);
            if (!video) {
                throw new AppError(404, "video_not_found", "Video not found");
            }
            const jobs = await client.query(`
          select
            id,
            job_type,
            status,
            attempt_count,
            error_message,
            queued_at,
            started_at,
            completed_at
          from public.processing_jobs
          where video_id = $1
          order by queued_at desc
        `, [params.id]);
            return {
                video_id: video.id,
                status: video.status,
                metadata_status: video.metadata_status,
                analysis_status: video.analysis_status,
                jobs: jobs.rows,
            };
        });
    });
    app.patch("/videos/:id", async (request) => {
        const auth = requireAuth(request);
        const params = IdParamsSchema.parse(request.params ?? {});
        const body = PatchSchema.parse(request.body ?? {});
        return withRlsUser(auth.user, async (client) => {
            const existing = await loadVideoById(client, params.id);
            if (!existing) {
                throw new AppError(404, "video_not_found", "Video not found");
            }
            const nextHashtags = body.hashtags ? normalizeHashtags(body.hashtags) : existing.hashtags;
            const nextSearchText = buildSearchText([
                body.title ?? existing.title ?? "",
                body.creator_name ?? existing.creator_name ?? "",
                body.creator_handle ?? existing.creator_handle ?? "",
                body.caption ?? existing.caption ?? "",
                body.description ?? existing.description ?? "",
                nextHashtags.join(" "),
                existing.collections.map((collection) => collection.name).join(" "),
            ]);
            await client.query(`
          update public.videos
          set
            title = coalesce($2, title),
            description = coalesce($3, description),
            caption = coalesce($4, caption),
            hashtags_json = coalesce($5::jsonb, hashtags_json),
            creator_name = coalesce($6, creator_name),
            creator_handle = coalesce($7, creator_handle),
            thumbnail_url = coalesce($8, thumbnail_url),
            embed_url = coalesce($9, embed_url),
            embed_html = coalesce($10, embed_html),
            duration_seconds = coalesce($11, duration_seconds),
            language_code = coalesce($12, language_code),
            content_type = coalesce($13, content_type),
            summary = coalesce($14, summary),
            search_text = $15,
            updated_at = now()
          where id = $1 and user_id = $16
        `, [
                params.id,
                body.title ?? null,
                body.description ?? null,
                body.caption ?? null,
                body.hashtags !== undefined ? JSON.stringify(nextHashtags) : null,
                body.creator_name ?? null,
                body.creator_handle ?? null,
                body.thumbnail_url ?? null,
                body.embed_url ?? null,
                body.embed_html ?? null,
                body.duration_seconds ?? null,
                body.language_code ?? null,
                body.content_type ?? null,
                body.summary ?? null,
                nextSearchText,
                auth.user.id,
            ]);
            await client.query(`
          insert into public.processing_jobs (video_id, job_type, status, attempt_count, queued_at)
          values ($1, 'index_video', 'queued', 0, now())
        `, [params.id]);
            await enqueueIndexJob(auth.user.id, params.id);
            const updated = await loadVideoById(client, params.id);
            return { video: updated };
        });
    });
    app.delete("/videos/:id", async (request) => {
        const auth = requireAuth(request);
        const params = IdParamsSchema.parse(request.params ?? {});
        return withRlsUser(auth.user, async (client) => {
            const existing = await loadVideoById(client, params.id);
            if (!existing) {
                throw new AppError(404, "video_not_found", "Video not found");
            }
            await client.query("delete from public.videos where id = $1 and user_id = $2", [
                params.id,
                auth.user.id,
            ]);
            return { ok: true };
        });
    });
};
