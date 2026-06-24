import type { PoolClient } from "pg";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { withRlsUser } from "../lib/db.js";
import { requireAuth } from "../lib/request.js";
import { hydrateVideos, type VideoBaseRow } from "../lib/video-records.js";
import { AppError } from "../lib/errors.js";

const ExportRegistry = new Map<
  string,
  {
    path: string;
    userId: string;
    expiresAt: number;
  }
>();

const TokenParamsSchema = z.object({
  token: z.string().min(1),
});

function buildVideoSelect(whereClause: string): string {
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

async function loadAllVideos(client: PoolClient, userId: string) {
  const result = await client.query<VideoBaseRow>(buildVideoSelect("where v.user_id = $1"), [
    userId,
  ]);
  return hydrateVideos(client, result.rows);
}

async function loadAllCollections(client: PoolClient, userId: string) {
  const result = await client.query<{
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    type: string;
    icon: string | null;
    rules_json: unknown;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }>(
    `
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
      where user_id = $1
      order by sort_order asc, created_at desc
    `,
    [userId],
  );

  return result.rows;
}

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.post("/export/request", async (request) => {
    const auth = requireAuth(request);

    return withRlsUser(auth.user, async (client) => {
      const videos = await loadAllVideos(client, auth.user.id);
      const collections = await loadAllCollections(client, auth.user.id);

      const token = randomUUID();
      const exportDir = join(tmpdir(), "contentcategorize-exports");
      await mkdir(exportDir, { recursive: true });

      const payload = {
        exported_at: new Date().toISOString(),
        user_id: auth.user.id,
        videos,
        collections,
      };

      const filePath = join(exportDir, `${token}.json`);
      await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

      ExportRegistry.set(token, {
        path: filePath,
        userId: auth.user.id,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });

      return {
        token,
        download_url: `/export/download/${token}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    });
  });

  app.get("/export/download/:token", async (request, reply) => {
    const params = TokenParamsSchema.parse(request.params ?? {});
    const record = ExportRegistry.get(params.token);

    if (!record || record.expiresAt < Date.now()) {
      ExportRegistry.delete(params.token);
      throw new AppError(404, "export_not_found", "Export token not found or expired");
    }

    const payload = await readFile(record.path, "utf8");
    reply
      .header("content-type", "application/json; charset=utf-8")
      .header("content-disposition", `attachment; filename="contentcategorize-export-${params.token}.json"`);

    return payload;
  });
};
