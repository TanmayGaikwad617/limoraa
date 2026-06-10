# Design Document

## Overview

ContentCategorize is a mobile-first private knowledge library for saving and organizing short-form video content from TikTok, Instagram, and YouTube. This design document describes the system architecture, component interactions, data models, and correctness properties that ensure the system meets its requirements.

The system follows a mobile-first, async-enrichment architecture where saves complete immediately while background workers enrich content with metadata and AI categorization. The design prioritizes privacy, simplicity, and maintainability over social features or complex infrastructure.

## Architecture

### System Components

The system consists of four primary components:

1. **Mobile Application** (React Native + Expo)
   - iOS and Android native apps
   - User interface for saving, browsing, searching, and organizing content
   - Native share target integration for capturing shared URLs
   - Authenticated API client

2. **Backend API** (Node.js + Fastify)
   - REST API server handling synchronous user requests
   - URL validation and normalization
   - Authentication and authorization
   - Job enqueueing
   - Search query processing

3. **Background Worker** (Node.js)
   - Asynchronous job processor
   - Metadata extraction from source platforms
   - AI categorization and enrichment
   - Search index maintenance
   - Smart collection rule evaluation

4. **Data Layer** (Supabase)
   - Postgres database with row-level security
   - Supabase Auth for authentication
   - Supabase Storage for app assets
   - pg-boss job queue backed by Postgres


### External Services

1. **RevenueCat** - Subscription management and entitlement sync
2. **AI Service** - Text-based categorization and summarization (metadata-only input)
3. **Platform Metadata Sources** - TikTok, Instagram, YouTube metadata APIs/parsers

### Architecture Principles

1. **Async-First Processing**: Save operations complete immediately; enrichment happens asynchronously
2. **Privacy by Design**: All user data isolated via row-level security; no public content layer
3. **Graceful Degradation**: Partial metadata is acceptable; missing fields don't block saves
4. **Observable State**: Processing status visible to users at all times
5. **Idempotent Jobs**: Background jobs can be retried safely without duplicating work
6. **Platform Isolation**: Each video platform has isolated parsing logic

## Components and Interfaces

### Mobile Application Architecture

#### Navigation Structure

```typescript
// Root navigation stack
AppNavigator
  ├─ AuthStack (unauthenticated)
  │   ├─ SignIn
  │   ├─ SignUp
  │   └─ ForgotPassword
  └─ MainTabs (authenticated)
      ├─ HomeTab
      │   ├─ HomeScreen (Masonry Grid)
      │   ├─ VideoDetailScreen
      │   └─ ProcessingQueueScreen
      ├─ SearchTab
      │   ├─ SearchScreen
      │   ├─ AdvancedFiltersScreen
      │   └─ VideoDetailScreen
      ├─ CollectionsTab
      │   ├─ CollectionsListScreen
      │   ├─ CollectionDetailScreen
      │   ├─ SmartCollectionBuilderScreen
      │   └─ VideoDetailScreen
      └─ ProfileTab
          ├─ ProfileScreen
          ├─ SubscriptionScreen
          ├─ SettingsScreen
          └─ HelpScreen
```


#### Key UI Components

**MasonryGrid Component**
- Pinterest-style thumbnail layout
- Infinite scroll with pagination (50 items per page)
- Displays video cards with thumbnail, creator, platform icon, title, tags, summary
- Shows processing indicators for incomplete items
- Supports filtering by platform and content type

**VideoCard Component**
- Thumbnail image with platform badge
- Creator name and handle
- Video title (truncated)
- AI tags (up to 5 visible)
- AI summary (truncated)
- Processing status indicator when not completed
- Relative time saved

**VideoDetailScreen**
- Header: thumbnail, platform, creator info
- Embed container (when supported) or thumbnail fallback
- Metadata section: title, caption, description, hashtags
- AI analysis section: summary, topic, format, intent, audience, quality score
- Vertical-specific fields section (conditional on vertical type)
- Editable tags section (user tags + AI tags with visual distinction)
- Collections section showing memberships
- Actions: Edit tags, Add to collection, Open original, Delete

**ShareTargetHandler**
- Captures shared URLs from native share menu
- Checks authentication status
- If authenticated: submits save request immediately
- If not authenticated: stores URL and prompts for sign-in


### Backend API Architecture

#### Route Organization

```
/auth
  POST   /session          - Create auth session
  POST   /logout           - End session
  POST   /password-reset   - Request password reset

/videos
  POST   /save             - Save single video URL
  POST   /bulk-save        - Save multiple URLs
  GET    /                 - List user videos (paginated, filtered)
  GET    /:id              - Get video details
  GET    /:id/status       - Get processing status
  PATCH  /:id              - Update video metadata
  DELETE /:id              - Delete video

/search
  GET    /                 - Search videos (query + filters)
  GET    /suggestions      - Get search suggestions

/collections
  POST   /                     - Create collection
  GET    /                     - List user collections
  GET    /:id                  - Get collection details
  PATCH  /:id                  - Update collection
  DELETE /:id                  - Delete collection
  POST   /:id/videos           - Add video to collection
  DELETE /:id/videos/:videoId  - Remove video from collection

/tags
  POST   /videos/:id/tags  - Add tag to video
  DELETE /videos/:id/tags  - Remove tag from video

/billing
  GET    /plan             - Get user plan and usage
  POST   /checkout         - Start subscription checkout
  POST   /webhook          - RevenueCat webhook handler

/export
  POST   /request          - Request data export
  GET    /download/:token  - Download export file
```


#### Middleware Pipeline

1. **Request Logger** - Log all incoming requests
2. **Authentication Middleware** - Validate JWT from Supabase Auth
3. **Rate Limiter** - Enforce per-user rate limits
4. **Validation Middleware** - Validate request schemas
5. **Authorization Middleware** - Check resource ownership via RLS
6. **Error Handler** - Format error responses consistently

#### URL Normalization Module

```typescript
interface URLNormalizer {
  normalize(url: string): NormalizedURL;
  detectPlatform(url: string): Platform | null;
  extractPlatformVideoId(url: string, platform: Platform): string;
}

interface NormalizedURL {
  canonical: string;           // Clean canonical URL
  platform: Platform;          // tiktok | instagram | youtube
  platformVideoId: string;     // Platform-specific video ID
  isValid: boolean;
}

// Normalization rules:
// - Strip tracking parameters (utm_*, fbclid, etc.)
// - Convert mobile URLs to desktop canonical form
// - Extract platform-specific video ID
// - Validate domain and path structure
```

**Examples:**
- `https://vm.tiktok.com/ABC123/` → `https://www.tiktok.com/@user/video/1234567890`
- `https://www.instagram.com/reel/ABC123/?igshid=xyz` → `https://www.instagram.com/reel/ABC123/`
- `https://youtube.com/shorts/ABC123?si=xyz` → `https://www.youtube.com/shorts/ABC123`


#### Save Flow Implementation

```typescript
async function handleSaveVideo(request: SaveVideoRequest): Promise<SaveVideoResponse> {
  // 1. Validate authentication
  const userId = await validateAuth(request.headers.authorization);
  
  // 2. Check rate limits
  await checkRateLimit(userId, 'save', { limit: 100, window: 3600 });
  
  // 3. Normalize URL
  const normalized = urlNormalizer.normalize(request.url);
  if (!normalized.isValid) {
    throw new ValidationError('Unsupported platform or invalid URL format');
  }
  
  // 4. Check for duplicate
  const existing = await db.videos.findByNormalizedUrl(userId, normalized.canonical);
  if (existing) {
    return { videoId: existing.id, isNew: false };
  }
  
  // 5. Check subscription quota
  await enforceQuota(userId, 'saves');
  
  // 6. Create video record
  const video = await db.videos.create({
    userId,
    sourceUrl: request.url,
    normalizedUrl: normalized.canonical,
    platform: normalized.platform,
    platformVideoId: normalized.platformVideoId,
    status: 'queued',
    savedAt: new Date()
  });
  
  // 7. Enqueue fetch_metadata job
  await jobQueue.enqueue('fetch_metadata', { videoId: video.id });
  
  // 8. Record usage event
  await db.usageEvents.create({ userId, eventType: 'save', timestamp: new Date() });
  
  return { videoId: video.id, isNew: true };
}
```


### Background Worker Architecture

#### Job Types and Handlers

**1. fetch_metadata Job**
```typescript
interface FetchMetadataJob {
  videoId: string;
}

async function handleFetchMetadata(job: FetchMetadataJob): Promise<void> {
  const video = await db.videos.findById(job.videoId);
  
  // Update status
  await db.videos.update(video.id, { status: 'fetching_metadata' });
  
  try {
    // Select platform-specific parser
    const parser = metadataParserFactory.getParser(video.platform);
    
    // Extract metadata
    const metadata = await parser.extract(video.normalizedUrl);
    
    // Store metadata (handles partial results gracefully)
    await db.videos.update(video.id, {
      title: metadata.title,
      description: metadata.description,
      caption: metadata.caption,
      hashtags: metadata.hashtags,
      creatorName: metadata.creatorName,
      creatorHandle: metadata.creatorHandle,
      thumbnailUrl: metadata.thumbnailUrl,
      embedUrl: metadata.embedUrl,
      embedHtml: metadata.embedHtml,
      durationSeconds: metadata.durationSeconds,
      language: metadata.language,
      status: 'analyzing'
    });
    
    // Enqueue AI analysis
    await jobQueue.enqueue('analyze_video', { videoId: video.id });
    
  } catch (error) {
    await handleJobFailure(job, error, { maxRetries: 3, retryDelay: 60 });
  }
}
```


**2. analyze_video Job**
```typescript
interface AnalyzeVideoJob {
  videoId: string;
}

async function handleAnalyzeVideo(job: AnalyzeVideoJob): Promise<void> {
  const video = await db.videos.findById(job.videoId);
  const user = await db.users.findById(video.userId);
  
  // Skip AI analysis for Free users
  if (user.plan === 'free') {
    await db.videos.update(video.id, { status: 'completed' });
    return;
  }
  
  // Check AI quota for Pro users
  await enforceQuota(user.id, 'ai_analyses');
  
  try {
    // Prepare input from text metadata only
    const input = {
      title: video.title,
      description: video.description,
      caption: video.caption,
      hashtags: video.hashtags,
      creatorName: video.creatorName,
      creatorHandle: video.creatorHandle,
      platform: video.platform,
      language: video.language
    };
    
    // Call AI categorizer
    const analysis = await aiCategorizer.analyze(input);
    
    // Store analysis results
    await db.videoAnalysis.create({
      videoId: video.id,
      summary: analysis.summary,
      topic: analysis.topic,
      format: analysis.format,
      intent: analysis.intent,
      audience: analysis.audience,
      verticalType: analysis.verticalType,
      qualityScore: analysis.qualityScore,
      tags: analysis.tags,
      verticalFields: analysis.verticalFields,
      analysisVersion: '1.0'
    });
    
    // Create AI tags
    for (const tag of analysis.tags) {
      await db.videoTags.create({
        videoId: video.id,
        tag: normalizeTag(tag),
        source: 'ai'
      });
    }
    
    // Update status
    await db.videos.update(video.id, { status: 'completed' });
    
    // Enqueue search indexing
    await jobQueue.enqueue('index_video', { videoId: video.id });
    
    // Enqueue smart collection refresh
    await jobQueue.enqueue('refresh_smart_collections', { videoId: video.id });
    
  } catch (error) {
    await handleJobFailure(job, error, { maxRetries: 3, retryDelay: 120 });
  }
}
```


**3. index_video Job**
```typescript
interface IndexVideoJob {
  videoId: string;
}

async function handleIndexVideo(job: IndexVideoJob): Promise<void> {
  const video = await db.videos.findById(job.videoId);
  const tags = await db.videoTags.findByVideoId(video.id);
  const analysis = await db.videoAnalysis.findByVideoId(video.id);
  const collections = await db.collections.findByVideoId(video.id);
  
  // Combine all searchable text
  const searchComponents = [
    video.title,
    video.creatorName,
    video.creatorHandle,
    video.caption,
    video.description,
    video.hashtags?.join(' '),
    analysis?.summary,
    tags.map(t => t.tag).join(' '),
    collections.map(c => c.name).join(' '),
    // Include vertical fields for search
    analysis?.verticalFields ? Object.values(analysis.verticalFields).flat().join(' ') : ''
  ].filter(Boolean).join(' ');
  
  // Update search_text field
  await db.videos.update(video.id, { searchText: searchComponents });
}
```

**4. refresh_smart_collections Job**
```typescript
interface RefreshSmartCollectionsJob {
  videoId: string;
}

async function handleRefreshSmartCollections(job: RefreshSmartCollectionsJob): Promise<void> {
  const video = await db.videos.findById(job.videoId);
  const analysis = await db.videoAnalysis.findByVideoId(video.id);
  const tags = await db.videoTags.findByVideoId(video.id);
  const smartCollections = await db.collections.findSmartCollections(video.userId);
  
  for (const collection of smartCollections) {
    const rules = collection.rules as SmartCollectionRules;
    const matches = evaluateRules(rules, { video, analysis, tags });
    
    if (matches) {
      // Add to collection if not already member
      await db.collectionVideos.upsert({
        collectionId: collection.id,
        videoId: video.id
      });
    } else {
      // Remove from collection if no longer matches
      await db.collectionVideos.delete({
        collectionId: collection.id,
        videoId: video.id
      });
    }
  }
}
```


#### Platform Parser Abstraction

```typescript
interface MetadataParser {
  extract(url: string): Promise<VideoMetadata>;
}

interface VideoMetadata {
  title?: string;
  description?: string;
  caption?: string;
  hashtags?: string[];
  creatorName?: string;
  creatorHandle?: string;
  thumbnailUrl?: string;
  embedUrl?: string;
  embedHtml?: string;
  durationSeconds?: number;
  language?: string;
}

class TikTokParser implements MetadataParser {
  async extract(url: string): Promise<VideoMetadata> {
    // TikTok-specific extraction logic
    // Uses oEmbed API or HTML scraping as fallback
    // Returns partial metadata if some fields unavailable
  }
}

class InstagramParser implements MetadataParser {
  async extract(url: string): Promise<VideoMetadata> {
    // Instagram-specific extraction logic
    // Uses oEmbed API or Graph API when available
  }
}

class YouTubeParser implements MetadataParser {
  async extract(url: string): Promise<VideoMetadata> {
    // YouTube-specific extraction logic
    // Uses YouTube Data API v3
  }
}

class MetadataParserFactory {
  getParser(platform: Platform): MetadataParser {
    switch (platform) {
      case 'tiktok': return new TikTokParser();
      case 'instagram': return new InstagramParser();
      case 'youtube': return new YouTubeParser();
      default: throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}
```


#### AI Categorization Service

```typescript
interface AICategorizer {
  analyze(input: AICategorizerInput): Promise<AIAnalysisResult>;
}

interface AICategorizerInput {
  title?: string;
  description?: string;
  caption?: string;
  hashtags?: string[];
  creatorName?: string;
  creatorHandle?: string;
  platform: Platform;
  language?: string;
}

interface AIAnalysisResult {
  summary: string;              // Max 200 characters
  topic: string;
  format: string;
  intent: string;
  audience: string;
  verticalType: VerticalType;
  qualityScore: number;         // 0-100
  tags: string[];               // 3-10 tags
  verticalFields: Record<string, any>;
}

type VerticalType = 
  | 'recipe' 
  | 'workout' 
  | 'tutorial_diy' 
  | 'beauty_fashion' 
  | 'education' 
  | 'entertainment' 
  | 'general';

// Vertical-specific field schemas
interface RecipeFields {
  ingredients?: string[];
  cuisine?: string;
  mealType?: string;
  cookingMethod?: string;
  dietType?: string;
  equipment?: string[];
}

interface WorkoutFields {
  muscleGroup?: string[];
  workoutType?: string;
  equipment?: string[];
  intensity?: string;
  skillLevel?: string;
  goal?: string;
}

interface TutorialDIYFields {
  tools?: string[];
  materials?: string[];
  skillLevel?: string;
  domain?: string;
  endResult?: string;
}

interface BeautyFashionFields {
  productType?: string[];
  style?: string;
  occasion?: string;
  brandMentions?: string[];
  aesthetic?: string;
}
```


## Data Models

### Database Schema

**users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free', -- 'free' | 'pro'
  saves_count INTEGER DEFAULT 0,
  ai_analyses_count INTEGER DEFAULT 0,
  default_sort_preference TEXT DEFAULT 'recent',
  language_preference TEXT DEFAULT 'en',
  notification_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = id);
```

**videos**
```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'tiktok' | 'instagram' | 'youtube'
  platform_video_id TEXT,
  title TEXT,
  description TEXT,
  caption TEXT,
  hashtags JSONB,
  creator_name TEXT,
  creator_handle TEXT,
  thumbnail_url TEXT,
  embed_url TEXT,
  embed_html TEXT,
  duration_seconds INTEGER,
  language TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'fetching_metadata' | 'analyzing' | 'completed' | 'failed'
  error_message TEXT,
  search_text TEXT,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, normalized_url)
);

CREATE INDEX idx_videos_user_saved ON videos(user_id, saved_at DESC);
CREATE INDEX idx_videos_user_platform ON videos(user_id, platform);
CREATE INDEX idx_videos_status ON videos(user_id, status);
CREATE INDEX idx_videos_search ON videos USING GIN(to_tsvector('english', search_text));
CREATE INDEX idx_videos_search_trigram ON videos USING GIN(search_text gin_trgm_ops);

-- RLS Policy
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY videos_all_own ON videos FOR ALL USING (auth.uid() = user_id);
```


**video_analysis**
```sql
CREATE TABLE video_analysis (
  video_id UUID PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
  summary TEXT,
  topic TEXT,
  format TEXT,
  intent TEXT,
  audience TEXT,
  vertical_type TEXT, -- 'recipe' | 'workout' | 'tutorial_diy' | 'beauty_fashion' | 'education' | 'entertainment' | 'general'
  quality_score INTEGER,
  vertical_fields JSONB,
  analysis_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_analysis_vertical ON video_analysis(vertical_type);
CREATE INDEX idx_video_analysis_fields ON video_analysis USING GIN(vertical_fields);

-- RLS Policy
ALTER TABLE video_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY video_analysis_select_own ON video_analysis FOR SELECT 
  USING (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_id AND videos.user_id = auth.uid()));
```

**video_tags**
```sql
CREATE TABLE video_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  source TEXT NOT NULL, -- 'ai' | 'user'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, tag, source)
);

CREATE INDEX idx_video_tags_video ON video_tags(video_id);
CREATE INDEX idx_video_tags_tag ON video_tags(tag);

-- RLS Policy
ALTER TABLE video_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY video_tags_all_own ON video_tags FOR ALL 
  USING (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_id AND videos.user_id = auth.uid()));
```


**collections**
```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'manual' | 'smart'
  icon TEXT,
  rules JSONB, -- For smart collections
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_collections_user ON collections(user_id);
CREATE INDEX idx_collections_type ON collections(user_id, type);

-- RLS Policy
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY collections_all_own ON collections FOR ALL USING (auth.uid() = user_id);
```

**collection_videos**
```sql
CREATE TABLE collection_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id, video_id)
);

CREATE INDEX idx_collection_videos_collection ON collection_videos(collection_id);
CREATE INDEX idx_collection_videos_video ON collection_videos(video_id);

-- RLS Policy
ALTER TABLE collection_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_videos_all_own ON collection_videos FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM collections 
    WHERE collections.id = collection_id AND collections.user_id = auth.uid()
  ));
```


**processing_jobs**
```sql
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL, -- 'fetch_metadata' | 'analyze_video' | 'index_video' | 'refresh_smart_collections'
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'running' | 'completed' | 'failed'
  attempt_count INTEGER DEFAULT 0,
  error_message TEXT,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_processing_jobs_video ON processing_jobs(video_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
```

**subscriptions**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revenuecat_subscriber_id TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL, -- 'free' | 'pro'
  status TEXT NOT NULL, -- 'active' | 'cancelled' | 'expired'
  period_end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- RLS Policy
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_select_own ON subscriptions FOR SELECT USING (auth.uid() = user_id);
```

**usage_events**
```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'save' | 'search' | 'ai_analysis' | 'upgrade'
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_events_user ON usage_events(user_id, timestamp DESC);
CREATE INDEX idx_usage_events_type ON usage_events(event_type, timestamp DESC);
```


### Search Implementation

#### Search Query Builder

```typescript
interface SearchQuery {
  query?: string;
  platform?: Platform[];
  verticalType?: VerticalType[];
  language?: string[];
  creator?: string;
  collectionId?: string;
  limit?: number;
  offset?: number;
}

async function searchVideos(userId: string, search: SearchQuery): Promise<VideoSearchResult[]> {
  let query = db.videos
    .select('videos.*, video_analysis.*, COUNT(*) OVER() as total_count')
    .leftJoin('video_analysis', 'videos.id', 'video_analysis.video_id')
    .where('videos.user_id', userId);
  
  // Full-text search with ranking
  if (search.query) {
    query = query
      .whereRaw(`
        to_tsvector('english', search_text) @@ plainto_tsquery('english', ?) 
        OR similarity(search_text, ?) > 0.3
      `, [search.query, search.query])
      .orderByRaw(`
        ts_rank(to_tsvector('english', search_text), plainto_tsquery('english', ?)) DESC,
        similarity(search_text, ?) DESC
      `, [search.query, search.query]);
  }
  
  // Platform filter
  if (search.platform?.length) {
    query = query.whereIn('videos.platform', search.platform);
  }
  
  // Vertical type filter
  if (search.verticalType?.length) {
    query = query.whereIn('video_analysis.vertical_type', search.verticalType);
  }
  
  // Language filter
  if (search.language?.length) {
    query = query.whereIn('videos.language', search.language);
  }
  
  // Creator filter
  if (search.creator) {
    query = query.where(function() {
      this.where('videos.creator_name', 'ilike', `%${search.creator}%`)
        .orWhere('videos.creator_handle', 'ilike', `%${search.creator}%`);
    });
  }
  
  // Collection filter
  if (search.collectionId) {
    query = query
      .join('collection_videos', 'videos.id', 'collection_videos.video_id')
      .where('collection_videos.collection_id', search.collectionId);
  }
  
  // Pagination
  query = query
    .limit(search.limit || 50)
    .offset(search.offset || 0);
  
  return await query;
}
```


### Smart Collections Rule Engine

```typescript
interface SmartCollectionRules {
  operator: 'AND' | 'OR';
  conditions: SmartCollectionCondition[];
}

interface SmartCollectionCondition {
  field: 'tag' | 'topic' | 'creator' | 'platform' | 'vertical_type';
  operator: 'contains' | 'equals' | 'not_equals';
  value: string;
}

function evaluateRules(
  rules: SmartCollectionRules,
  context: { video: Video; analysis: VideoAnalysis; tags: VideoTag[] }
): boolean {
  const results = rules.conditions.map(condition => 
    evaluateCondition(condition, context)
  );
  
  return rules.operator === 'AND' 
    ? results.every(r => r) 
    : results.some(r => r);
}

function evaluateCondition(
  condition: SmartCollectionCondition,
  context: { video: Video; analysis: VideoAnalysis; tags: VideoTag[] }
): boolean {
  const { field, operator, value } = condition;
  
  switch (field) {
    case 'tag':
      const tagValues = context.tags.map(t => t.tag);
      return operator === 'contains' 
        ? tagValues.some(t => t.includes(value.toLowerCase()))
        : false;
    
    case 'topic':
      const topic = context.analysis?.topic?.toLowerCase() || '';
      return operator === 'equals' 
        ? topic === value.toLowerCase()
        : operator === 'not_equals'
        ? topic !== value.toLowerCase()
        : topic.includes(value.toLowerCase());
    
    case 'creator':
      const creator = context.video.creatorHandle?.toLowerCase() || 
                     context.video.creatorName?.toLowerCase() || '';
      return operator === 'equals'
        ? creator === value.toLowerCase()
        : creator.includes(value.toLowerCase());
    
    case 'platform':
      return operator === 'equals'
        ? context.video.platform === value.toLowerCase()
        : context.video.platform !== value.toLowerCase();
    
    case 'vertical_type':
      return operator === 'equals'
        ? context.analysis?.verticalType === value.toLowerCase()
        : context.analysis?.verticalType !== value.toLowerCase();
    
    default:
      return false;
  }
}
```


### Subscription and Entitlement Management

#### Quota Enforcement

```typescript
interface QuotaLimits {
  free: {
    saves: 50;           // per month
    aiAnalyses: 0;       // no AI for free tier
    smartCollections: 0;
  };
  pro: {
    saves: 10000;        // effectively unlimited
    aiAnalyses: 10000;   // effectively unlimited
    smartCollections: 100;
  };
}

async function enforceQuota(userId: string, quotaType: 'saves' | 'ai_analyses'): Promise<void> {
  const user = await db.users.findById(userId);
  const subscription = await db.subscriptions.findByUserId(userId);
  
  const plan = subscription?.plan || 'free';
  const limits = QuotaLimits[plan];
  
  // Get usage for current month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const usage = await db.usageEvents.count({
    userId,
    eventType: quotaType === 'saves' ? 'save' : 'ai_analysis',
    timestamp: { gte: startOfMonth }
  });
  
  const limit = quotaType === 'saves' ? limits.saves : limits.aiAnalyses;
  
  if (usage >= limit) {
    throw new QuotaExceededError(
      `${quotaType} limit of ${limit} per month exceeded. Upgrade to Pro for more.`
    );
  }
}
```

#### RevenueCat Webhook Handler

```typescript
async function handleRevenueCatWebhook(event: RevenueCatEvent): Promise<void> {
  const { type, app_user_id, product_id, expiration_at_ms } = event;
  
  // Map RevenueCat subscriber ID to user ID
  const subscription = await db.subscriptions.findByRevenueCatId(app_user_id);
  if (!subscription) {
    throw new Error(`Subscription not found for RevenueCat ID: ${app_user_id}`);
  }
  
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
      await db.subscriptions.update(subscription.id, {
        plan: 'pro',
        status: 'active',
        periodEndAt: new Date(expiration_at_ms)
      });
      await db.users.update(subscription.userId, { plan: 'pro' });
      break;
    
    case 'CANCELLATION':
      await db.subscriptions.update(subscription.id, {
        status: 'cancelled'
      });
      break;
    
    case 'EXPIRATION':
      await db.subscriptions.update(subscription.id, {
        plan: 'free',
        status: 'expired'
      });
      await db.users.update(subscription.userId, { plan: 'free' });
      break;
  }
}
```


## Error Handling

### Job Retry Logic

```typescript
interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // seconds
  backoffMultiplier?: number;
}

async function handleJobFailure(
  job: any,
  error: Error,
  config: RetryConfig
): Promise<void> {
  const { videoId } = job;
  const jobRecord = await db.processingJobs.findLatest(videoId, job.type);
  
  jobRecord.attemptCount += 1;
  jobRecord.errorMessage = error.message;
  
  if (jobRecord.attemptCount < config.maxRetries) {
    // Schedule retry with exponential backoff
    const delay = config.retryDelay * 
      Math.pow(config.backoffMultiplier || 2, jobRecord.attemptCount - 1);
    
    await jobQueue.enqueue(job.type, job, { delay });
    await db.processingJobs.update(jobRecord.id, {
      status: 'queued',
      attemptCount: jobRecord.attemptCount,
      errorMessage: jobRecord.errorMessage
    });
  } else {
    // Max retries exceeded, mark as failed
    await db.videos.update(videoId, {
      status: 'failed',
      errorMessage: `Failed after ${jobRecord.attemptCount} attempts: ${error.message}`
    });
    await db.processingJobs.update(jobRecord.id, {
      status: 'failed',
      completedAt: new Date()
    });
  }
}
```

### Error Response Patterns

1. **400 Bad Request** - Invalid URL format, unsupported platform, malformed request body
2. **401 Unauthorized** - Missing or invalid JWT token
3. **403 Forbidden** - User attempting to access another user's resources
4. **404 Not Found** - Video ID or collection ID does not exist
5. **409 Conflict** - Duplicate save attempt (returns existing video ID)
6. **429 Too Many Requests** - Rate limit or quota exceeded
7. **500 Internal Server Error** - Unexpected server errors
8. **503 Service Unavailable** - External service (AI, metadata parser) temporarily unavailable

### Logging Strategy

- **Request logs**: All API requests with user ID, endpoint, status, duration
- **Job logs**: Job start, completion, failure with timing and errors
- **Error logs**: Structured error context with user ID, video ID, stack traces
- **Performance logs**: Response times, search result counts, queue depths
- **Usage logs**: Saves, searches, AI analyses for billing and analytics

### Graceful Degradation

1. **Partial metadata**: Store available fields, proceed with analysis
2. **AI service unavailable**: Store video with "analyzing" state, retry later
3. **Platform parser failure**: Store basic URL info, mark for manual review
4. **Search service degradation**: Fall back to basic text matching if full-text search fails

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Supported Platform URL Validation and Record Creation

*For any* valid TikTok, Instagram, or YouTube Short URL, when submitted through the save endpoint, the system SHALL validate the URL format and create a Save_Item record with correct platform identification and normalized URL.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: URL Normalization Canonicalization

*For any* video URL with tracking parameters or mobile variants, the normalization process SHALL produce a canonical form by removing tracking parameters and converting mobile URLs to desktop canonical format, and applying this transformation twice SHALL produce the same result as applying it once (idempotence).

**Validates: Requirements 1.4**

### Property 3: Initial Processing State

*For any* newly created Save_Item record, the Processing_State SHALL be set to "queued" at creation time.

**Validates: Requirements 1.5**

### Property 4: Job Enqueueing on Save

*For any* newly created Save_Item record, a fetch_metadata job SHALL be enqueued in the Queue.

**Validates: Requirements 1.6**

### Property 5: Unsupported URL Rejection

*For any* URL that does not match the domain patterns for TikTok, Instagram, or YouTube, the Backend_API SHALL return an error response indicating the platform is not supported.

**Validates: Requirements 1.7**

### Property 6: Duplicate URL Idempotence

*For any* video URL, saving it multiple times SHALL return the same Save_Item identifier, preventing duplicate records for the same normalized URL.

**Validates: Requirements 1.8**


### Property 7: Platform Parser Routing

*For any* fetch_metadata job with a specified platform, the Background_Worker SHALL invoke the correct platform-specific Metadata_Parser corresponding to that platform.

**Validates: Requirements 2.1**

### Property 8: Metadata Persistence Completeness

*For any* successful metadata extraction, all available fields (title, creator name, creator handle, description, caption, hashtags, thumbnail URL, embed URL/HTML, duration, language) SHALL be stored in the Save_Item record.

**Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

### Property 9: Metadata Success State Transition

*For any* Save_Item where metadata extraction completes successfully, the Processing_State SHALL transition from "fetching_metadata" to "analyzing".

**Validates: Requirements 2.10**

### Property 10: Metadata Success Job Chain

*For any* Save_Item where metadata extraction completes successfully, an analyze_video job SHALL be enqueued in the Queue.

**Validates: Requirements 2.11**

### Property 11: Metadata Retry and Failure Handling

*For any* metadata extraction that fails, the job SHALL be retried up to 3 times, and after the third failure, the Processing_State SHALL be set to "failed" with the error message stored.

**Validates: Requirements 2.12**

### Property 12: Partial Metadata Graceful Handling

*For any* metadata extraction that produces partial results, the available fields SHALL be stored and the analyze_video job SHALL still be enqueued to continue processing.

**Validates: Requirements 2.13**


### Property 13: Pro Subscriber AI Invocation

*For any* analyze_video job for a Save_Item owned by a Pro subscriber, the Background_Worker SHALL invoke the AI_Categorizer with the Save_Item metadata.

**Validates: Requirements 3.1**

### Property 14: AI Output Structure Completeness

*For any* AI categorization invocation, the AI_Categorizer SHALL produce a structured output containing summary (≤200 characters), topic, format, intent, audience, vertical type, quality score (0-100), and 3-10 tags.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**

### Property 15: Vertical-Specific Field Extraction

*For any* Save_Item categorized with vertical_type as "recipe", "workout", "tutorial_diy", or "beauty_fashion", the AI_Categorizer SHALL extract the corresponding vertical-specific structured fields when present in the metadata.

**Validates: Requirements 3.10, 3.11, 3.12, 3.13**

### Property 16: AI Analysis Persistence

*For any* successful AI analysis, the results SHALL be stored in the video_analysis table.

**Validates: Requirements 3.14**

### Property 17: AI Success State Transition

*For any* Save_Item where AI analysis completes successfully, the Processing_State SHALL transition to "completed".

**Validates: Requirements 3.15**

### Property 18: AI Success Indexing Job Chain

*For any* Save_Item where AI analysis completes successfully, an index_video job SHALL be enqueued in the Queue.

**Validates: Requirements 3.16**

### Property 19: AI Retry and Failure Handling

*For any* AI analysis that fails, the job SHALL be retried up to 3 times, and after the third failure, the Processing_State SHALL be set to "failed" with the error message stored.

**Validates: Requirements 3.17**

### Property 20: AI Output Schema Validation

*For any* AI_Categorizer invocation, the returned output SHALL validate against the defined JSON schema for AIAnalysisResult.

**Validates: Requirements 3.20**


### Property 21: Search Index Composition

*For any* Save_Item with metadata and analysis, the Search_Index SHALL combine title, creator name, creator handle, caption, description, hashtags, summary, AI tags, user tags, collection names, and vertical fields into the search_text field.

**Validates: Requirements 4.1**

### Property 22: Search Index Persistence

*For any* index_video job execution, the videos table search_text field SHALL be updated with the composed search index.

**Validates: Requirements 4.2**

### Property 23: Tag Addition Triggers Reindexing

*For any* manual tag addition to a Save_Item, an index_video job SHALL be enqueued in the Queue.

**Validates: Requirements 4.3**

### Property 24: Collection Membership in Search Index

*For any* Save_Item that is a member of one or more Collections, the Collection names SHALL be included in the Search_Index.

**Validates: Requirements 4.4**

### Property 25: Video Card Rendering Completeness

*For any* Save_Item rendered in a Masonry_Grid, the card SHALL display thumbnail, creator name, platform icon, title, AI tags, summary, and relative saved time when these fields are available.

**Validates: Requirements 5.3**

### Property 26: Processing Indicator Display

*For any* Save_Item with Processing_State not equal to "completed", the rendered card SHALL display a processing indicator.

**Validates: Requirements 5.4**

### Property 27: Quick Filter Application

*For any* quick filter selection (platform or content type), the Masonry_Grid SHALL reload showing only Save_Item records that match the selected filter criteria.

**Validates: Requirements 5.7**


### Property 28: Video Detail Field Completeness

*For any* Save_Item displayed on the video detail screen, all available metadata fields (thumbnail, platform, creator info, title, caption, description, hashtags, AI analysis fields, vertical fields, tags, collection memberships) SHALL be rendered.

**Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8**

### Property 29: Search Result Matching

*For any* search query, all returned Save_Item records SHALL contain the query terms in at least one of the indexed searchable fields (title, creator, caption, description, hashtags, summary, tags, collection names, vertical fields).

**Validates: Requirements 8.3, 8.6**

### Property 30: Advanced Filter Combination

*For any* combination of advanced filters (platform, content type, language, creator, collection), all returned Save_Item records SHALL match all applied filter criteria using AND logic.

**Validates: Requirements 9.7, 9.8, 9.9**

### Property 31: Collection Membership Operations

*For any* Save_Item and Collection, adding the item to the collection SHALL create a collection_videos record, and removing the item SHALL delete that record.

**Validates: Requirements 10.8, 10.9**

### Property 32: Collection Deletion Cascade

*For any* Collection deletion, both the Collection record and all associated collection_videos join records SHALL be deleted.

**Validates: Requirements 10.10**

### Property 33: Smart Collection Rule Evaluation

*For any* Save_Item and Smart_Collection with defined rules, the Background_Worker SHALL correctly evaluate whether the item matches the rule criteria and create or delete collection_videos membership accordingly.

**Validates: Requirements 11.6, 11.7, 11.8**


### Property 34: User Tag Operations and Reindexing

*For any* user tag addition or removal on a Save_Item, a video_tags record SHALL be created or deleted with source set to "user", and an index_video job SHALL be enqueued.

**Validates: Requirements 12.2, 12.3, 12.4**

### Property 35: Tag Normalization

*For any* tag text input, the system SHALL normalize it to lowercase with underscores replacing spaces before storage.

**Validates: Requirements 12.6**

### Property 36: Subscription-Based Feature Access

*For any* user with Free subscription tier, Pro-only features (AI analysis, smart collections) SHALL be inaccessible or trigger paywall display, and for any Pro subscriber, these features SHALL be accessible.

**Validates: Requirements 11.1, 11.9, 14.3, 14.9**

### Property 37: Quota Enforcement by Tier

*For any* user, the Backend_API SHALL enforce save and AI analysis quotas based on subscription tier (Free: 50 saves/0 AI per month, Pro: unlimited).

**Validates: Requirements 14.8, 14.9, 14.10**

### Property 38: Job Idempotence

*For any* background job (fetch_metadata, analyze_video, index_video, refresh_smart_collections), executing it multiple times SHALL produce the same result as executing it once, without duplicating work or side effects.

**Validates: Requirements 17.2**

### Property 39: Job State Preservation on Partial Failure

*For any* multi-step processing pipeline, if a later step fails, the successfully completed earlier step's data SHALL be preserved.

**Validates: Requirements 17.3**


### Property 40: URL Protocol and Domain Validation

*For any* save request, the Backend_API SHALL validate that the URL uses HTTPS protocol and matches one of the supported platform domains (TikTok, Instagram, YouTube), returning a 400 error for invalid URLs.

**Validates: Requirements 19.1, 19.2, 19.4**

## Testing Strategy

### Unit Testing Approach

Unit tests will focus on:

1. **URL normalization logic** - Test canonical form generation for various URL formats
2. **Platform detection** - Test platform identification from URL patterns
3. **Smart collection rule evaluation** - Test rule matching logic with various conditions
4. **Search query building** - Test filter combination and query construction
5. **Tag normalization** - Test text transformation rules
6. **Quota calculation** - Test usage counting and limit enforcement
7. **Error handling** - Test specific error conditions and edge cases

Unit tests should verify specific examples and edge cases, complementing property-based tests which cover broad input spaces.

### Property-Based Testing Approach

Property tests will verify universal properties across randomized inputs:

1. **URL properties** - Generate random valid/invalid URLs, test normalization, validation, duplicate handling
2. **Metadata persistence** - Generate random metadata structures, verify complete storage
3. **State transition properties** - Generate random processing sequences, verify state machine correctness
4. **Search properties** - Generate random video libraries and queries, verify result matching
5. **Filter properties** - Generate random filter combinations, verify correct filtering
6. **Collection membership** - Generate random videos and collections, verify membership operations
7. **Smart collection rules** - Generate random videos and rule sets, verify automatic membership
8. **Tag operations** - Generate random tags, verify normalization and indexing
9. **Quota properties** - Generate random usage patterns, verify enforcement
10. **Job idempotence** - Generate random jobs, verify multiple executions produce consistent state

Each property test should run at least 100 iterations and reference the corresponding design property using the tag format: **Feature: content-categorization-saas, Property N: [property text]**


### Integration Testing Approach

Integration tests will verify:

1. **End-to-end save flow** - Submit URL through API, verify job processing chain, check final state
2. **Authentication flow** - Test Supabase Auth integration
3. **Row-level security** - Verify users can only access their own data
4. **RevenueCat webhook** - Test subscription state synchronization
5. **Share target** - Test native share menu capture on iOS and Android
6. **Platform parsers** - Test actual metadata extraction from real URLs (with mocked responses)
7. **Database triggers and indexes** - Verify full-text search and trigram matching work correctly
8. **Job queue** - Test pg-boss queue processing with actual Postgres

Integration tests should use 1-3 representative examples per scenario and focus on verifying system wiring and external service integration.

## Security Considerations

### Authentication and Authorization

1. All API endpoints (except auth) require valid JWT from Supabase Auth
2. Row-level security enforces data isolation at database level
3. Service-role credentials used only in Backend API and Background Worker, never exposed to clients
4. Token validation on every protected request

### Input Validation

1. URL protocol and domain validation before processing
2. Request schema validation on all endpoints
3. SQL injection prevention via parameterized queries
4. XSS prevention via output encoding

### Rate Limiting

1. Per-user rate limits: 100 saves/hour, 1000 searches/hour
2. 429 responses with Retry-After headers on limit exceeded
3. Distributed rate limiting using Redis or Postgres-backed counters

### Data Privacy

1. All user data private by default
2. No public content exposure
3. User deletion removes all associated records via CASCADE
4. Data export available on request


## Performance Considerations

### API Response Time Targets

- Save request: <1 second (immediate queueing)
- Search request: <2 seconds for typical library sizes
- Video detail: <500ms
- Collection operations: <500ms

### Background Job Processing Targets

- Metadata fetch: <10 seconds when supported by platform
- AI analysis: <5 seconds per video
- Search indexing: <2 seconds
- End-to-end enrichment: <15 seconds for most videos

### Database Optimization

1. Indexes on frequently queried fields (user_id, saved_at, platform, status)
2. Full-text search index on search_text field
3. Trigram index for fuzzy matching
4. JSONB GIN indexes for vertical_fields queries
5. Connection pooling for database connections

### Caching Strategy

1. User session and subscription data cached in-memory (short TTL)
2. Collection membership cached for smart collection evaluation
3. Search query results cached for common queries (5-minute TTL)
4. Metadata parser responses cached by normalized URL (1-hour TTL)

### Scalability Considerations

1. Horizontal scaling of Backend API servers behind load balancer
2. Background Worker scaling by adding more worker processes
3. Database read replicas for search queries if needed
4. CDN for thumbnail images when using Supabase Storage
5. Job queue concurrency tuning based on load


## Deployment Architecture

### Environment Configuration

**Development**
- Local React Native development with Expo
- Local Node.js API and Worker
- Local Postgres database
- Mock AI categorizer for testing

**Staging**
- Expo development build
- Backend API on cloud platform (Heroku, Railway, or Render)
- Background Worker as separate service
- Supabase staging project
- Test RevenueCat environment

**Production**
- Expo production build deployed to App Store and Google Play
- Backend API on cloud platform with auto-scaling
- Background Worker with configurable concurrency
- Supabase production project
- Production RevenueCat configuration

### Infrastructure Requirements

1. **Backend API Server**
   - Node.js 18+
   - 512MB RAM minimum, 1GB recommended
   - Environment variables: DATABASE_URL, SUPABASE_SERVICE_KEY, AI_API_KEY, REVENUECAT_SECRET

2. **Background Worker**
   - Node.js 18+
   - 1GB RAM minimum, 2GB recommended
   - Same environment variables as API

3. **Database**
   - Postgres 14+
   - Extensions: pg_trgm, pgcrypto
   - Supabase free tier sufficient for MVP, Pro tier for production

4. **Mobile App**
   - React Native 0.71+
   - Expo SDK 48+
   - iOS 13+, Android 8+

### Deployment Process

1. Database migrations run automatically on deploy
2. Backend API deployed with zero-downtime rolling updates
3. Background Worker gracefully drains jobs before restart
4. Mobile app deployed through Expo OTA updates (non-native changes) or app store releases (native changes)


## Monitoring and Observability

### Key Metrics

**Application Metrics**
- API request rate and response times
- Error rates by endpoint
- Background job processing rate and duration
- Queue depth and age of oldest job
- Processing success/failure rates

**Business Metrics**
- New saves per day
- Active users per day
- Search queries per day
- Subscription conversion rate
- Quota usage by tier

**Infrastructure Metrics**
- CPU and memory usage
- Database connection pool utilization
- Database query performance
- API server response times
- Worker throughput

### Logging

Structured JSON logs with:
- Timestamp
- Log level (debug, info, warn, error)
- Context (user_id, video_id, job_id)
- Message
- Metadata (request_id, duration, status_code)

### Alerting

Critical alerts:
- API error rate >5% for 5 minutes
- Background job failure rate >20% for 10 minutes
- Database connection pool exhausted
- Queue depth >1000 jobs for 15 minutes
- RevenueCat webhook failures

## Future Enhancements

### Phase 2 Features

1. **Enhanced Search**
   - Vector embeddings for semantic search
   - Search by visual similarity using thumbnails
   - Natural language search queries

2. **Collaboration**
   - Shared collections with other users
   - Collection visibility controls
   - Activity feed for shared collections

3. **Advanced Organization**
   - Nested collections
   - Bulk operations (tag multiple videos, move to collection)
   - Custom sorting rules per collection

4. **Analytics Dashboard**
   - Viewing patterns and trends
   - Creator analytics
   - Collection growth over time

### Phase 3 Features

1. **Web Application**
   - Browser-based access to library
   - Browser extension for saving
   - Sync between mobile and web

2. **Export and Backup**
   - Scheduled automatic exports
   - Export to different formats (CSV, JSON, Markdown)
   - Integration with note-taking apps

3. **API Access**
   - Public API for third-party integrations
   - Webhooks for collection updates
   - OAuth for third-party app authorization

