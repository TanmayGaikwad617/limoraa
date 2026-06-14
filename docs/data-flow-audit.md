# Data Flow Audit: Frontend (Expo) ↔ Backend (Fastify)

---

## A. API Routes Inventory

### Public Routes (no auth)

| Method | Path | Auth | Request Body | Response |
|--------|------|------|-------------|----------|
| `POST` | `/auth/session` | No (Bearer) | _empty_ | `{ ok: true, user: User }` |
| `POST` | `/auth/logout` | No (Bearer) | _empty_ | `{ ok: true }` |
| `POST` | `/auth/password-reset` | No | `{ email: string, redirect_to?: string }` | `{ ok: true, sent: true, email: string }` |
| `POST` | `/billing/webhook` | No | `{ type, app_user_id, product_id?, expiration_at_ms? }` | `{ ok: true }` |
| `GET` | `/health` | No | — | `{ status, service, database, uptimeSeconds, requestId, timestamp }` |
| `GET` | `/export/download/:token` | No | — | JSON file (attachment) |

### Authenticated Routes (all require `Authorization: Bearer <supabase_jwt>`)

| Method | Path | Request Body / Query | Response |
|--------|------|---------------------|----------|
| `POST` | `/videos/save` | `{ url: string }` | `{ is_new: bool, video: HydratedVideo\|null, queue_enqueued: bool, queue_error?: string }` |
| `POST` | `/videos/bulk-save` | `{ urls: string[] }` (max 50) | `{ items: Array<{ is_new, video, queue_enqueued }> }` |
| `GET` | `/videos` | Query: `limit, offset, platform, content_type, language, creator, collection_id, status, q` | `{ items: HydratedVideo[], limit: number, offset: number }` |
| `GET` | `/videos/:id` | — | `{ video: HydratedVideo }` |
| `GET` | `/videos/:id/status` | — | `{ video_id, status, metadata_status, analysis_status, jobs: ProcessingJob[] }` |
| `PATCH` | `/videos/:id` | Partial `{ title?, description?, caption?, hashtags?, creator_name?, creator_handle?, thumbnail_url?, embed_url?, embed_html?, duration_seconds?, language_code?, content_type?, summary? }` | `{ video: HydratedVideo }` |
| `DELETE` | `/videos/:id` | — | `{ ok: true }` |
| `POST` | `/videos/:id/tags` | `{ tag?: string, tags?: string[] }` | `{ ok: true, tags: string[] }` |
| `DELETE` | `/videos/:id/tags` | `{ tag?: string, tags?: string[] }` | `{ ok: true, tags: string[] }` |
| `GET` | `/search` | Query: `q, limit, offset, platform, content_type, ...` | `{ items: HydratedVideo[], limit, offset }` |
| `GET` | `/search/suggestions` | Query: `q?, limit` | `{ suggestions: string[] }` |
| `GET` | `/collections` | — | `{ items: CollectionItem[] }` (with item_count) |
| `POST` | `/collections` | `{ name, description?, type?, icon?, rules_json?, sort_order? }` | `{ collection: Collection }` |
| `GET` | `/collections/:id` | — | `{ collection: Collection & { videos: HydratedVideo[] } }` |
| `PATCH` | `/collections/:id` | Partial collection fields | `{ collection: Collection }` |
| `DELETE` | `/collections/:id` | — | `{ ok: true }` |
| `POST` | `/collections/:id/videos` | `{ video_id: string }` or `{ videoId: string }` | `{ ok: true }` |
| `DELETE` | `/collections/:id/videos/:videoId` | — | `{ ok: true }` |
| `GET` | `/billing/plan` | — | `{ profile: ProfileWithQuota, subscription: Subscription\|null }` |
| `POST` | `/billing/checkout` | `{ product_id?, entitlement_id? }` | `{ checkout_ready: true, subscription: Subscription }` |
| `POST` | `/export/request` | — | `{ token, download_url, expires_at }` |

---

## B. Frontend Data Flow (by Screen)

### LoginScreen
| Aspect | Details |
|--------|---------|
| **API calls** | None to backend. Uses `supabase.auth.signInWithPassword()` / `signUp()` directly via `AuthContext` |
| **When** | On form submit |
| **Props** | None |
| **Local state** | `email`, `password`, `loading`, `isSignUp` |
| **Sends to backend** | Nothing via REST. Auth is handled entirely through Supabase client SDK → token propagated via `setAuthToken()` in `AuthContext` |

### HomeScreen
| Aspect | Details |
|--------|---------|
| **API calls** | `GET /videos` (via `fetchVideos()` → `data/library.ts` → `api/client.ts`) |
| **On mount** | `GET /videos?limit=50&offset=0` → sets initial videos, offset to 50 |
| **On scroll end** | `GET /videos?limit=50&offset=N` → appends to videos array |
| **On pull-to-refresh** | `GET /videos?limit=50&offset=0` → resets videos and offset |
| **Props** | `{ onOpen: (item: VideoItem) => void }` |
| **Local state** | `videos: VideoItem[]`, `loading`, `refreshing`, `loadingMore`, `offset`, `hasMore`, `error` |
| **Sends to backend** | Nothing (no save/edit actions wired) |

> **Note:** The "Processing" section displays hardcoded static text ("0 items being analyzed") — it does NOT call `GET /videos/:id/status` or filter videos by `status`. The quick-filter pills are also purely visual; they don't re-fetch with filter params.

### SearchScreen
| Aspect | Details |
|--------|---------|
| **API calls** | `GET /search` (via `searchVideos()` → `data/library.ts`) |
| **On text input** | Debounced 300ms → `GET /search?q=<term>` |
| **Props** | `{ onOpen: (item: VideoItem) => void }` |
| **Local state** | `query`, `results: VideoItem[]`, `loading`, `searched`, debounce timer |
| **Sends to backend** | Search query string only |
| **Gap** | Does NOT call `GET /search/suggestions`. Hardcoded `recentSearches` and `suggestedFilters` arrays used instead. |

### DetailScreen
| Aspect | Details |
|--------|---------|
| **API calls** | **None** — operates entirely on the `VideoItem` passed via props |
| **Props** | `{ item: VideoItem \| null }` |
| **Local state** | None |
| **Sends to backend** | Nothing. No PATCH, tag-add, or collection-add actions are wired. The "Open original" button uses `Linking.openURL()` client-side. |
| **Gap** | No way to edit tags, change collection, or trigger re-analysis from this screen. The only way tags get added is via the worker pipeline (AI) or the `POST /videos/:id/tags` endpoint, which isn't called by any screen. |

### CollectionsScreen
| Aspect | Details |
|--------|---------|
| **API calls** | `GET /collections` (via `fetchCollections()`) |
| **On mount** | `GET /collections` → sets collections list |
| **Props** | None |
| **Local state** | `collections: CollectionItem[]`, `loading` |
| **Sends to backend** | Nothing. No create, edit, or delete collection actions are wired. The "Create collection" pill is visual-only. |
| **Gap** | No call to `GET /collections/:id` for detail view. No `POST /collections/:id/videos` to add items to collections. |

### ProfileScreen
| Aspect | Details |
|--------|---------|
| **API calls** | **None** to the backend API |
| **When** | Sign-out uses `AuthContext.signOut()` → Supabase SDK directly |
| **Props** | None |
| **Local state** | None |
| **Sends to backend** | Nothing |
| **Gap** | Does NOT call `GET /billing/plan`. Usage values (42/100, 15/25) are hardcoded. Does NOT call `POST /billing/checkout`. No plan upgrade flow is wired. The `POST /export/request` flow is not exposed. |

---

## C. Worker Job Pipeline

```
User submits URL
       │
       ▼
  POST /videos/save
       │
       ├─ normalizeVideoUrl(url) → { canonical, platform, platformVideoId }
       ├─ Check existing by normalized_url → if found, return existing (no new job)
       ├─ INSERT INTO public.videos (status='queued', metadata_status='queued', analysis_status='queued')
       ├─ INSERT INTO public.processing_jobs (job_type='fetch_metadata', status='queued')
       ├─ INSERT INTO public.usage_events (event_type='save')
       ├─ pgBoss.send("fetch_metadata", { videoId, userId })
       │
       ▼
  ┌──────────────────────────────────────────────┐
  │  WORKER: fetch_metadata handler               │
  │                                               │
  │  1. UPDATE processing_jobs → status='running' │
  │  2. UPDATE videos → status='fetching_metadata'│
  │  3. Call platform parser:                      │
  │     - YouTube:  parseYouTube(source_url)       │
  │     - Instagram: parseInstagram(source_url)    │
  │     - Twitter/X: parseTwitter(source_url)      │
  │     - TikTok/fallback: buildStubMetadata()     │
  │  4. UPDATE videos SET title, description,      │
  │     creator_name, thumbnail_url, embed_url,    │
  │     hashtags_json, language_code,              │
  │     status='analyzing', metadata_status='completed'
  │  5. pgBoss.send("analyze_video", { videoId })  │
  │  6. UPDATE processing_jobs → status='succeeded'│
  └──────────────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────────────┐
  │  WORKER: analyze_video handler                │
  │                                               │
  │  1. Load video + tags + collections           │
  │  2. Call analyzeVideoMetadata() (Gemini AI)   │
  │     Returns: { topic, format, intent,         │
  │     audience, vertical_type, quality_score,   │
  │     tags[], vertical_fields, summary,          │
  │     confidence }                               │
  │  3. UPSERT into public.video_analysis         │
  │  4. INSERT into public.video_tags (source='ai')│
  │  5. UPDATE videos SET summary, search_text,    │
  │     status='ready', analysis_status='completed'│
  │  6. INSERT processing_jobs (index_video)       │
  │  7. pgBoss.send("index_video", { videoId })    │
  └────────────────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────────────┐
  │  WORKER: index_video handler                  │
  │                                               │
  │  1. Load video (with tags, collections,       │
  │     analysis)                                  │
  │  2. Build search_text from: title, description,│
  │     caption, creator, platform, tags,          │
  │     analysis topic/category/summary,           │
  │     collection names                           │
  │  3. UPDATE videos SET search_text              │
  │  4. INSERT processing_jobs                     │
  │     (refresh_smart_collections)                │
  │  5. pgBoss.send("refresh_smart_collections",   │
  │     { videoId })                               │
  └────────────────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────────────┐
  │  WORKER: refresh_smart_collections handler    │
  │                                               │
  │  1. Load video (tags + analysis)              │
  │  2. SELECT collections WHERE type='smart'     │
  │  3. For each smart collection:                 │
  │     - Evaluate rules (tag_contains,           │
  │       topic_equals, creator_equals,            │
  │       platform_equals)                         │
  │     - If matches → INSERT collection_videos    │
  │     - If no match & exists → DELETE            │
  │  4. UPDATE processing_jobs → 'succeeded'       │
  └────────────────────────────────────────────────┘
       │
       ▼
  Video is now status='ready' with full metadata,
  AI analysis, tags, search index, and smart
  collection membership evaluated.
```

### Data Read/Written at Each Worker Step

| Worker | Reads from DB | Writes to DB |
|--------|--------------|-------------|
| **fetchMetadata** | `videos` (row by id) | `videos.status, title, description, creator_name, thumbnail_url, embed_url, hashtags_json, language_code, metadata_status, search_text`; `processing_jobs.status, started_at` |
| **analyzeVideo** | `videos` (row by id) | `video_analysis` (insert/upsert); `video_tags` (insert ai tags); `videos.summary, status, analysis_status, search_text`; `processing_jobs` (insert index_video) |
| **indexVideo** | `videos` (full hydrated with tags, collections, analysis) | `videos.search_text`; `processing_jobs` (insert refresh_smart_collections) |
| **refreshSmartCollections** | `videos` (tags, analysis); `collections` (smart ones); `collection_videos` (check membership) | `collection_videos` (insert/delete); `processing_jobs.status` |

---

## D. Database Tables Touched by Each Endpoint

| Endpoint | SELECTs | INSERT/UPDATE/DELETEs | Triggers |
|----------|---------|----------------------|----------|
| `POST /auth/session` | — (JWT verify only) | — | — |
| `POST /auth/logout` | — | Supabase Auth (admin signOut) | — |
| `POST /auth/password-reset` | — | Supabase Auth (resetPasswordForEmail) | — |
| `POST /videos/save` | `videos` (dedup check), `profiles` (via RLS) | `videos` (INSERT), `processing_jobs` (INSERT), `usage_events` (INSERT) | `set_videos_updated_at` |
| `POST /videos/bulk-save` | same as above × N | same as above × N | same |
| `GET /videos` | `videos`, `video_tags`, `video_analysis`, `collections`+`collection_videos` (via hydrateVideos) | — | — |
| `GET /videos/:id` | same as GET /videos | — | — |
| `GET /videos/:id/status` | `videos`, `processing_jobs` (by video_id) | — | — |
| `PATCH /videos/:id` | `videos` (check exists + hydrate) | `videos` (UPDATE), `processing_jobs` (INSERT index_video) | `set_videos_updated_at` |
| `DELETE /videos/:id` | `videos` (check exists) | `videos` (DELETE — cascades to tags, analysis, collection_videos, processing_jobs) | cascade |
| `POST /videos/:id/tags` | `videos` (check exists via loadVideoById) | `video_tags` (INSERT), `processing_jobs` (INSERT index_video) | — |
| `DELETE /videos/:id/tags` | `videos` (check exists) | `video_tags` (DELETE), `processing_jobs` (INSERT index_video) | — |
| `GET /search` | `videos`, `video_tags`, `video_analysis`, `collections`+`collection_videos` | — | — |
| `GET /search/suggestions` | `videos` (title, creator), `video_tags`, `collections` (name) | — | — |
| `GET /collections` | `collections`, `collection_videos` (count) | — | — |
| `POST /collections` | — | `collections` (INSERT) | `set_collections_updated_at` |
| `GET /collections/:id` | `collections`, `collection_videos`+`videos` (with hydrate) | — | — |
| `PATCH /collections/:id` | `collections` (check exists) | `collections` (UPDATE); `processing_jobs` (INSERT index_video for each video) | `set_collections_updated_at` |
| `DELETE /collections/:id` | `collections` (with videos) | `collections` (DELETE); `processing_jobs` (INSERT index_video for each video) | — |
| `POST /collections/:id/videos` | `collections`, `videos` | `collection_videos` (INSERT), `processing_jobs` (INSERT index_video) | — |
| `DELETE /collections/:id/videos/:videoId` | `collections` | `collection_videos` (DELETE), `processing_jobs` (INSERT index_video) | — |
| `GET /billing/plan` | `profiles` (quota fields), `subscriptions` | — | — |
| `POST /billing/checkout` | `subscriptions` (check exists) | `subscriptions` (INSERT/UPDATE) | `set_subscriptions_updated_at` |
| `POST /billing/webhook` | `subscriptions` (by user_id) | `subscriptions` (UPDATE status/plan), `profiles` (UPDATE plan) | both updated_at triggers |
| `POST /export/request` | `videos` (all), `collections` (all) | — (writes JSON to tmpdir) | — |
| `GET /export/download/:token` | — (reads tmpdir file) | — | — |
| `GET /health` | `select 1` | — | — |

---

## E. Error Paths

### User is not authenticated (401)
| Layer | Behavior |
|-------|----------|
| **Auth middleware** | `authenticate()` throws `AppError(401, "missing_authorization", ...)` if no Bearer token, or if JWT verification fails |
| **Error handler** | `app.ts` catches `AppError`, returns `{ error: { code: "missing_authorization", message, requestId } }` with HTTP 401 |
| **Frontend API client** | On 401 response: clears `authToken`, throws `Error("Unauthorized. Please sign in again.")` |
| **Screens** | Errors propagate to callers. HomeScreen shows an error banner with "Retry" button. SearchScreen silently catches and shows empty results. |
| **No auto-redirect** | There is no automatic redirect to LoginScreen on 401. The error surfaces as a UI message on the current screen. |

### User quota exceeded
| Layer | Behavior |
|-------|----------|
| **Current state** | **No quota enforcement exists.** The `profiles` table has `monthly_save_limit` (default 100) and `monthly_ai_limit` (default 25), but no endpoint or middleware checks these before allowing saves or AI analyses. |
| **Gap** | The `POST /videos/save` handler does not read the user's profile limits or current monthly count before inserting. Quota enforcement is not implemented. |

### Video save fails
| Step | Behavior |
|------|----------|
| **Invalid URL** | `normalizeVideoUrl()` throws `AppError(400, "invalid_url" / "unsupported_platform" / "unsupported_url")` → HTTP 400 |
| **DB insert fails** | `AppError(500, "insert_failed", ...)` → HTTP 500 |
| **pg-boss send fails** | Catches error → updates video `status='failed'`, `metadata_status='failed'`, writes error to `processing_jobs.error_message` → returns 200 with `queue_enqueued: false, queue_error: "..."` |
| **Frontend** | `saveVideo()` propagates API errors. No screen currently calls it, so error propagation is untested in UI. |

### Search times out
| Layer | Behavior |
|-------|----------|
| **Backend** | Uses standard Fastify request timeout (default no timeout). Full-text search uses `websearch_to_tsquery` on GIN-indexed `search_text` — should be fast. No explicit timeout middleware. |
| **Frontend** | Fetch API will reject on network failure or timeout (browser/RN default is ~5min). SearchScreen catches errors silently and shows no results. |

### Processing job fails
| Step | Behavior |
|------|----------|
| **fetchMetadata fails** | Worker catches error → UPDATE `videos.status='failed', metadata_status='failed'`; UPDATE `processing_jobs.status='failed', error_message=...`; re-throws (pg-boss retries) |
| **analyzeVideo fails** | Worker error → transaction rollback. pg-boss re-queues; default retry. If repeatedly fails, video stays in `analyzing` status. |
| **indexVideo / refreshSmartCollections fails** | Caught by pg-boss, retries. Partial DB writes within transaction roll back on error. |
| **Frontend visibility** | No screen queries `GET /videos/:id/status` or filters by `status=failed`. Failed videos are invisible in the UI. |

---

## F. Current Gaps

### Fully Implemented but Unused Endpoints

| Endpoint | Backend Status | Frontend Usage |
|----------|---------------|----------------|
| `GET /videos/:id/status` | ✅ Implemented (`videos.ts:430`) Returns video status + `processing_jobs` array per video | ❌ **Not called** by any screen. HomeScreen's "Processing" section is static HTML with hardcoded counts. |
| `PATCH /videos/:id` | ✅ Implemented (`videos.ts:477`) Full partial update for video metadata fields | ❌ **Not called** by any screen. DetailScreen is read-only. |
| `POST /videos/:id/tags` | ✅ Implemented (`tags.ts:27`) | ❌ **Not called** by any screen. `addTags()` exists in `api/client.ts` but no screen imports it. |
| `DELETE /videos/:id/tags` | ✅ Implemented (`tags.ts:68`) | ❌ **Not called** by any screen. |
| `POST /collections/:id/videos` | ✅ Implemented (`collections.ts:368`) | ❌ **Not called** — no way to add videos to collections from UI. |
| `DELETE /collections/:id/videos/:videoId` | ✅ Implemented (`collections.ts:414`) | ❌ **Not called** — no way to remove videos from collections in UI. |
| `POST /collections` | ✅ Implemented (`collections.ts:191`) | ❌ **Not called** — "Create collection" pill is visual-only. |
| `PATCH /collections/:id` | ✅ Implemented (`collections.ts:262`) | ❌ **Not called**. |
| `DELETE /collections/:id` | ✅ Implemented (`collections.ts:337`) | ❌ **Not called**. |
| `DELETE /videos/:id` | ✅ Implemented (`videos.ts:555`) | ❌ **Not called** by any screen. `deleteVideo()` exists in `api/client.ts` but unused. |
| `POST /videos/bulk-save` | ✅ Implemented (`videos.ts:390`) | ❌ **Not called**. |
| `POST /videos/save` | ✅ Implemented (`videos.ts:384`) | ❌ **Not called** — the "+" button in HomeScreen is not wired to any URL input UI. |
| `GET /billing/plan` | ✅ Implemented (`billing.ts:20`) | ❌ **Not called** — ProfileScreen uses hardcoded "42 / 100" and "15 / 25". |
| `POST /billing/checkout` | ✅ Implemented (`billing.ts:85`) | ❌ **Not called** — no upgrade flow exists. |
| `POST /export/request` | ✅ Implemented (`export.ts:105`) | ❌ **Not called**. |
| `GET /search/suggestions` | ✅ Implemented (`search.ts:33`) | ❌ **Not called** — SearchScreen uses hardcoded `recentSearches` / `suggestedFilters`. |
| `GET /collections/:id` | ✅ Implemented (`collections.ts:248`) | ❌ **Not called** — no drill-into-collection path exists. |

### Feature Gaps

1. **No quota enforcement** — `POST /videos/save` never checks `profiles.monthly_save_count` or `monthly_save_limit` before inserting.
2. **No auto-401 redirect** — When a token expires, the error surfaces as an in-screen banner; there's no redirect to LoginScreen.
3. **No queue/status screen** — HomeScreen's processing panel is fully hardcoded. Users cannot see which videos are queued, processing, or failed.
4. **Filter pills are visual-only** — HomeScreen and SearchScreen filter pills do not re-fetch with filter params.
5. **Collections are read-only in UI** — No create, edit, delete, add-to, or remove-from-collection actions wired.
6. **No edit UI on DetailScreen** — Tags, metadata, and collection assignment are read-only.
7. **No URL save UI** — The "+" button in the hero card has no handler wired.
8. **Search lacks suggestions and pagination** — Uses `searchVideos` but not `fetchSuggestions`, and has no infinite scroll / load-more.
9. **Profile usage is hardcoded** — No call to `GET /billing/plan`. No upgrade flow.
