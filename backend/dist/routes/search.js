import { z } from "zod";
import { requireAuth } from "../lib/request.js";
import { withRlsUser } from "../lib/db.js";
import { PaginationSchema, loadVideos } from "./videos.js";
const SuggestionsQuerySchema = z.object({
    q: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10),
});
export const searchRoutes = async (app) => {
    app.addHook("preHandler", app.authenticate);
    app.get("/search", async (request) => {
        const auth = requireAuth(request);
        const query = PaginationSchema.parse(request.query ?? {});
        return withRlsUser(auth.user, async (client) => {
            const items = await loadVideos(client, auth.user.id, {
                ...query,
                q: query.q ?? "",
            });
            return {
                items,
                limit: query.limit,
                offset: query.offset,
            };
        });
    });
    app.get("/search/suggestions", async (request) => {
        const auth = requireAuth(request);
        const query = SuggestionsQuerySchema.parse(request.query ?? {});
        return withRlsUser(auth.user, async (client) => {
            const pattern = query.q ? `%${query.q}%` : "%";
            const result = await client.query(`
          select distinct suggestion
          from (
            select title as suggestion
            from public.videos
            where user_id = $1 and title is not null and lower(title) like lower($2)

            union

            select creator_name as suggestion
            from public.videos
            where user_id = $1 and creator_name is not null and lower(creator_name) like lower($2)

            union

            select creator_handle as suggestion
            from public.videos
            where user_id = $1 and creator_handle is not null and lower(creator_handle) like lower($2)

            union

            select tag as suggestion
            from public.video_tags vt
            join public.videos v on v.id = vt.video_id
            where v.user_id = $1 and lower(tag) like lower($2)

            union

            select name as suggestion
            from public.collections c
            where c.user_id = $1 and lower(name) like lower($2)
          ) suggestions
          order by suggestion asc
          limit $3
        `, [auth.user.id, pattern, query.limit]);
            return {
                suggestions: result.rows.map((row) => row.suggestion),
            };
        });
    });
};
