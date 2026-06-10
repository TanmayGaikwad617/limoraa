# ContentCategorize - Technical Requirements Document (TRD)

**Version:** 1.2  
**Date:** June 2026  
**Status:** Draft  
**Owner:** Founder  

---

## 1. Technical Summary

ContentCategorize is a mobile-first application for saving TikTok videos, Instagram Reels, and YouTube Shorts into a private, searchable knowledge library. The v1 system must accept a shared URL, fetch whatever metadata is available, run metadata-only AI categorization, and make the saved item searchable without building heavy media-processing infrastructure.

The product direction is intentionally private-library first:
- no public feed
- no discovery layer
- no public content graph
- no social interactions

The system should therefore optimize for fast save, trustworthy async processing, retrieval quality, and long-term maintainability over engagement loops.

**Platforms:** iOS and Android first  
**Primary Market:** US and Europe  
**Business Model:** Subscription with free tier limits  
**Technical Priorities:** low cost, async processing, privacy by default, future web compatibility  

---

## 2. Product-Aligned Technical Goals

1. Let a user save a supported URL from mobile in one action
2. Reflect save state immediately in the app, even before enrichment completes
3. Make saved items searchable by title, creator, hashtags, description, summary, tags, collections, and vertical fields
4. Keep async processing observable through clear queue states
5. Preserve a calm private-library UX by preventing technical delays from blocking the user
6. Keep infrastructure lean until meaningful paid usage exists

---

## 3. Non-Goals (v1)

- audio transcription pipelines
- video downloads for analysis
- permanent video storage
- discovery ranking
- social graph
- public profiles
- collaborative collections
- Elasticsearch, vector databases, or microservices
- enterprise admin or compliance suites

---

## 4. Recommended Architecture

### Mobile App
- React Native with Expo
- Native share target support for iOS and Android
- Authenticated requests to backend APIs
- Thumbnail-first masonry browsing surfaces for Home, Search, and Collections
- UI support for partial states:
  - saved
  - metadata fetching
  - analyzing
  - ready
  - failed

### Backend API
- Node.js with Fastify
- REST-style APIs for save, library, search, collections, billing, and account flows

### Background Worker
- Separate Node.js worker for:
  - metadata fetch
  - AI categorization
  - search indexing
  - smart collection refresh

### Database and Platform Services
- Supabase Postgres
- Supabase Auth
- Supabase Storage only for app-owned assets such as cached thumbnails or exports when needed
- Row-level security on all user-owned content

### Queue and Jobs
- `pg-boss` backed by Postgres

### Billing
- RevenueCat for mobile subscriptions and entitlement handling

### Why this stack
- Minimal operational complexity
- Works for a solo founder or very small team
- Keeps mobile and future web clients on the same API contract
- Supports async enrichment without introducing extra infrastructure too early

---

## 5. High-Level System Flows

### Save Flow
1. User shares or pastes a supported URL
2. App sends authenticated save request
3. API normalizes the URL and validates platform support
4. API creates a `videos` row with initial status `queued`
5. API returns success immediately
6. API enqueues background jobs
7. Worker fetches metadata
8. Worker runs metadata-only AI analysis
9. Worker writes searchable text and structured analysis fields
10. Video status updates to `ready` or `failed`

### Playback Flow
1. User taps a thumbnail card from Home, Search, or Collections
2. App opens the detail screen
3. Client attempts to render an in-app embed for the platform when supported
4. If embed is unavailable, client falls back to thumbnail, metadata, and source link

### Search Flow
1. User searches from the app
2. API queries Postgres full-text and structured indexes
3. API returns ranked results with metadata needed for cards
4. Client applies filters such as platform, collection, content type, and language

### Collection Flow
1. User creates manual or smart collection
2. Manual collections link items directly
3. Smart collections store rules
4. Worker refreshes smart collection membership when item metadata or analysis changes

---

## 6. Data Model Requirements

### users
- account identity
- plan
- usage counters
- preferences

### videos
- `id`
- `user_id`
- `source_url`
- `normalized_url`
- `platform`
- `platform_video_id`
- `title`
- `description`
- `caption`
- `hashtags_json`
- `creator_name`
- `creator_handle`
- `thumbnail_url`
- `embed_url`
- `embed_html`
- `duration_seconds`
- `language`
- `status`
- `summary`
- `search_text`
- `metadata_status`
- `analysis_status`
- `saved_at`
- `updated_at`

### video_tags
- normalized AI and user tags

Fields:
- `id`
- `video_id`
- `tag`
- `source`
- `created_at`

### video_analysis
- structured AI output

Fields:
- `video_id`
- `topic`
- `format`
- `intent`
- `audience`
- `vertical_type`
- `quality_score`
- `tags_json`
- `vertical_fields_json`
- `analysis_version`
- `created_at`

### collections
- `id`
- `user_id`
- `name`
- `type`
- `icon`
- `rules_json`
- `created_at`

### collection_videos
- join table between collections and videos

### processing_jobs
- `id`
- `video_id`
- `job_type`
- `status`
- `attempt_count`
- `error_message`
- `queued_at`
- `started_at`
- `completed_at`

### usage_events
- save, search, AI, quota, billing, and upgrade events

### subscriptions
- RevenueCat entitlement status and plan state

---

## 7. Search Indexing Strategy

`search_text` should combine:
- title
- creator name
- creator handle
- caption
- description
- hashtags
- summary
- AI tags
- user tags
- collection names
- important vertical fields

This supports strong keyword retrieval while keeping architecture simple.

---

## 8. API Requirements

### Auth
- `POST /auth/session`
- `POST /auth/logout`

### Save and Item Retrieval
- `POST /videos/save`
- `POST /videos/bulk-save`
- `GET /videos/:id`
- `GET /videos/:id/status`

### Library
- `GET /videos`
- `PATCH /videos/:id`
- `DELETE /videos/:id`

### Search
- `GET /search?q=`

Supported filters:
- `platform`
- `collection_id`
- `content_type`
- `language`
- `vertical_type`
- `creator`

### Collections
- `POST /collections`
- `PATCH /collections/:id`
- `DELETE /collections/:id`
- `POST /collections/:id/videos`
- `DELETE /collections/:id/videos/:videoId`

### Billing
- `GET /billing/plan`
- `POST /billing/checkout`
- `POST /billing/webhook`

---

## 9. Metadata Ingestion Requirements

### Supported Inputs
- TikTok URL
- Instagram Reel URL
- YouTube Short URL

### Metadata Fields to Collect
- canonical URL
- platform
- creator name
- creator handle
- title when available
- description or caption when available
- hashtags when available
- thumbnail URL
- embed URL or embed HTML when available from the source or oEmbed provider
- duration when available
- language when known

### Source Rules
- Prefer official or stable metadata sources where practical
- Missing metadata is acceptable
- Save must succeed even with partial metadata
- Each platform parser should be isolated behind a source-specific layer
- Embed support must be treated as best effort and platform specific

### URL Normalization
- strip tracking parameters where possible
- normalize mobile and desktop variants
- map duplicates to canonical form

---

## 10. AI Analysis Requirements

### Core Rule
AI categorization must use text metadata only.

The system must not depend on:
- transcript text
- speech-to-text vendors
- downloaded media

### Inputs
- title
- caption
- description
- hashtags
- creator metadata
- platform

### v1 Model Strategy
- one small structured text model call per item
- JSON output only

### Required Outputs
- summary
- topic
- format
- intent
- audience
- language confirmation when needed
- quality score or confidence estimate
- suggested tags
- vertical type
- vertical fields

### Vertical Types
- recipe
- workout
- tutorial_diy
- beauty_fashion
- education
- entertainment
- general

### Example Vertical Fields

**recipe**
- ingredients
- cuisine
- meal_type
- cooking_method
- diet_type
- equipment

**workout**
- muscle_group
- workout_type
- equipment
- intensity
- skill_level
- goal

**tutorial_diy**
- tools
- materials
- skill_level
- domain
- end_result

**beauty_fashion**
- product_type
- style
- occasion
- brand_mentions
- aesthetic

### Analysis Rules
- analysis runs only after metadata fetch completes
- AI never blocks the save response
- sparse metadata should still produce a saved record
- manual editing must remain available if AI fails or is weak

---

## 11. Embed Requirements

### Product behavior
- Home, Search, and Collection views should remain thumbnail first
- Actual playback belongs on the detail screen

### Platform support target
- YouTube: first-class embedded playback
- Instagram Reels: attempt public embed support when available
- TikTok: attempt embed support when available

### Client strategy
- Prefer embeddable web content inside a platform-safe container such as WebView
- Do not block the detail screen on embed success
- Always show a fallback source link

### Data requirements
- store enough source metadata to derive or cache embed presentation
- allow `embed_html` to be nullable
- allow `embed_url` to be nullable

---

## 12. Search Requirements

### v1 Architecture
- Postgres full-text search
- `pg_trgm` for fuzzy matching
- indexed structured filters
- JSONB filters for vertical fields

### Searchable Fields
- title
- creator name
- creator handle
- caption
- description
- hashtags
- summary
- AI tags
- user tags
- collection names
- vertical fields

### Deferred Features
- vector search
- conversational search assistant
- popularity ranking
- cross-user recommendation signals

---

## 13. Job Processing Requirements

### Queue Technology
- `pg-boss`

### Required Job Types
- `fetch_metadata`
- `analyze_video`
- `index_video`
- `refresh_smart_collections`

### Worker Rules
- jobs must be idempotent
- retries must be bounded
- failures must be observable
- a later failed step must not erase earlier successful work
- job state must map cleanly to user-visible queue states

### User-Visible Processing States
- queued
- fetching_metadata
- analyzing
- completed
- failed

---

## 14. Mobile App Requirements

### v1 Responsibilities
- authentication
- share intent handling
- save request submission
- library browsing with masonry thumbnail layouts
- search UI
- collection management
- item detail view
- upgrade and paywall flow
- profile and settings

### UX Behavior Requirements
- the app must render a saved item immediately after submit
- users must be able to see processing state without guessing
- partial metadata states must be gracefully displayed
- failed items must support retry or manual cleanup
- embeds must degrade gracefully to thumbnail plus source link

### Share Flow
- iOS and Android share target support is mandatory
- incoming URLs must be preserved if auth is required first

---

## 15. Billing and Entitlements

### Billing
- RevenueCat handles subscriptions and lifecycle updates
- backend enforces entitlements server-side

### Usage Limits
- saved videos per month
- AI analyses per month
- smart collection availability
- advanced filter availability if needed by plan

### Plans

**Free**
- limited saves
- basic search
- manual collections
- limited or no deep AI analysis

**Pro**
- higher or unlimited saves
- AI summary and categorization
- smart collections
- richer filters and organization

---

## 16. Security and Privacy

### Security
- Supabase Auth for user identity
- row-level security on all user-owned tables
- service-role credentials only in backend and worker
- input validation on all incoming URLs
- rate limits on save and search endpoints

### Privacy
- all content private by default
- no public content layer
- no ad network integration
- user deletion flow required
- export support planned

### Compliance Posture
- do not market permanent archival in v1
- do not download raw media for processing in v1
- respect source platform restrictions where applicable

---

## 17. Performance Requirements

### API
- save request response under 1 second for queueing
- search response under 2 seconds for typical libraries
- collection CRUD under 500ms

### Processing
- metadata fetch under 10 seconds when supported
- searchable state under 15 seconds for most saves

### Reliability
- save success must not depend on AI completion
- partial success states are acceptable
- duplicate handling should reduce repeated processing work

---

## 18. Cost-Control Requirements

### Hard Rules
- no transcription in v1
- no video downloads in v1
- no permanent video storage in v1
- no multiple LLM calls per item
- no always-on semantic indexing
- no processing until the user explicitly saves content
- strict server-side quotas by plan

### Soft Rules
- start with one AI provider
- use Postgres search before introducing search infrastructure
- reuse metadata analysis for duplicate canonical URLs where permitted
- keep worker concurrency conservative until demand grows
- skip deep analysis when metadata quality is too sparse

---

## 19. Rollout Plan

### Phase 1
- mobile app with save, library, search, manual collections, profile
- metadata ingestion
- basic AI summary and categorization
- RevenueCat subscriptions

### Phase 2
- smart collections
- better retry and admin tooling
- richer filter UX
- improved vertical extraction quality

### Phase 3
- web app
- browser extension
- optional richer search
- team features if validated

---

## 20. Technical Risks

- platform metadata availability may be inconsistent
- metadata quality may be sparse for some saves
- duplicate normalization may be tricky across platforms
- smart collection accuracy depends on analysis quality
- share-target reliability varies across iOS and Android
- embed behavior may change across public and restricted posts

---

## 21. Acceptance Criteria

The technical foundation is complete for v1 when:

1. A user can save a supported short-video URL from mobile
2. The backend stores the record and queues enrichment immediately
3. The app shows a clear processing state before enrichment completes
4. Most supported items become searchable within 15 seconds
5. Search finds results by title, creator, hashtags, summary, tags, and structured fields
6. Manual and smart collection flows are supported by the data model and APIs
7. Free and paid entitlements are enforced server-side
8. User data is isolated through row-level security
9. The system does not require media download or transcription
10. The detail screen supports in-app playback when embeds are available and clean fallback when they are not
