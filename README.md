# ContentCategorize

ContentCategorize is a private, mobile-first library for saving TikTok videos, Instagram Reels, and YouTube Shorts into a searchable personal archive. It is built around fast saving, quiet organization, and metadata-only AI enrichment.

## What It Does

- Saves supported short-form video URLs
- Fetches available platform metadata
- Runs metadata-only AI analysis for summaries, tags, topic, intent, audience, and vertical fields
- Indexes content for search and smart collections
- Keeps the experience private by default

## Repo Layout

- `App.tsx` and `src/` contain the Expo mobile app
- `backend/` contains the Fastify API and `pg-boss` worker
- `supabase/` contains the database schema
- `docs/` contains the PRD, TRD, and setup notes

## Prerequisites

- Node.js 20+
- npm
- Supabase project and keys
- A Postgres database
- Optional AI provider keys for metadata analysis

## Getting Started

Install dependencies from the repo root:

```bash
npm install
```

Run the mobile app:

```bash
npm start
```

Run the backend API:

```bash
cd backend
npm run dev
```

Run the backend worker:

```bash
cd backend
npm run worker
```

Type-check the mobile app:

```bash
npm run typecheck
```

Type-check the backend:

```bash
cd backend
npm run typecheck
```

## Backend Environment

The backend reads configuration from environment variables in `backend/src/config/env.ts`.

Required:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional platform metadata keys:

- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `YOUTUBE_API_KEY`
- `TWITTER_BEARER_TOKEN`

AI metadata analyzer:

- `GEMINI_API_KEY`

If `GEMINI_API_KEY` is missing, the worker falls back to a safe conservative metadata-only analysis result.

## Database Setup

Use the schema in `supabase/schema.sql` and the checklist in [docs/03_SUPABASE_SETUP.md](docs/03_SUPABASE_SETUP.md).

The schema includes:

- `videos`
- `video_tags`
- `video_analysis`
- `collections`
- `collection_videos`
- `processing_jobs`
- `usage_events`
- `subscriptions`

## Worker Pipeline

The backend worker processes saves in stages:

1. Fetch metadata
2. Analyze metadata only
3. Save summary, tags, and structured analysis
4. Update the video to `ready`
5. Re-index the item
6. Refresh smart collections

Important constraints:

- The analyzer never uses audio, frames, OCR, or transcription
- The analyzer returns JSON only
- Invalid JSON is repaired once before falling back safely
- Worker failures should not bubble into uncaught fatal errors for a video

## AI Analysis Output

The analyzer returns:

- `summary`
- `topic`
- `format`
- `intent`
- `audience`
- `vertical_type`
- `quality_score`
- `confidence`
- `tags`
- `vertical_fields`

Allowed topics, formats, intents, and vertical types are constrained in the worker so the output stays consistent and searchable.

## Development Notes

- The mobile app is Expo-based and uses React Native.
- The backend is Node.js with Fastify, Supabase Auth, Postgres, and `pg-boss`.
- Search and smart collections rely on normalized metadata plus AI-enriched fields.
- The product is designed as a private library, not a social feed.

## Documentation

- [docs/01_PRD.md](docs/01_PRD.md)
- [docs/02_TRD.md](docs/02_TRD.md)
- [docs/03_SUPABASE_SETUP.md](docs/03_SUPABASE_SETUP.md)
- [docs/design.md](docs/design.md)

## Notes

The repository currently separates the Expo app and the backend service. If you add deployment scripts or CI later, this README is a good place to document the exact environment variables and release steps for each target.
