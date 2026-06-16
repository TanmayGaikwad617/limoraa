import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { withRlsUser } from "../lib/db.js";
import { requireAuth } from "../lib/request.js";
import { getBoss } from "../lib/pgboss.js";
import { loadVideoById } from "./videos.js";
import { normalizeTag } from "../lib/video.js";
const TagBodySchema = z.object({
    tag: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
});
const TagParamsSchema = z.object({
    id: z.string().uuid(),
});
function pickTags(body) {
    const values = body.tags ?? (body.tag ? [body.tag] : []);
    return values.map(normalizeTag).filter(Boolean);
}
export const tagRoutes = async (app) => {
    app.addHook("preHandler", app.authenticate);
    app.post("/videos/:id/tags", async (request) => {
        const auth = requireAuth(request);
        const params = TagParamsSchema.parse(request.params ?? {});
        const body = TagBodySchema.parse(request.body ?? {});
        const tags = pickTags(body);
        if (tags.length === 0) {
            throw new AppError(400, "invalid_request", "Provide tag or tags");
        }
        return withRlsUser(auth.user, async (client) => {
            const video = await loadVideoById(client, params.id);
            if (!video) {
                throw new AppError(404, "video_not_found", "Video not found");
            }
            for (const tag of tags) {
                await client.query(`
            insert into public.video_tags (video_id, tag, source)
            values ($1, $2, 'user')
            on conflict do nothing
          `, [params.id, tag]);
            }
            await client.query(`
          insert into public.processing_jobs (video_id, job_type, status, attempt_count, queued_at)
          values ($1, 'index_video', 'queued', 0, now())
        `, [params.id]);
            await getBoss().send("index_video", { videoId: params.id, userId: auth.user.id });
            return { ok: true, tags };
        });
    });
    app.delete("/videos/:id/tags", async (request) => {
        const auth = requireAuth(request);
        const params = TagParamsSchema.parse(request.params ?? {});
        const body = TagBodySchema.parse(request.body ?? {});
        const tags = pickTags(body);
        if (tags.length === 0) {
            throw new AppError(400, "invalid_request", "Provide tag or tags");
        }
        return withRlsUser(auth.user, async (client) => {
            const video = await loadVideoById(client, params.id);
            if (!video) {
                throw new AppError(404, "video_not_found", "Video not found");
            }
            for (const tag of tags) {
                await client.query(`
            delete from public.video_tags
            where video_id = $1 and tag = $2 and source = 'user'
          `, [params.id, tag]);
            }
            await client.query(`
          insert into public.processing_jobs (video_id, job_type, status, attempt_count, queued_at)
          values ($1, 'index_video', 'queued', 0, now())
        `, [params.id]);
            await getBoss().send("index_video", { videoId: params.id, userId: auth.user.id });
            return { ok: true, tags };
        });
    });
};
