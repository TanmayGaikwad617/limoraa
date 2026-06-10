# Requirements Document

## Introduction

ContentCategorize is a mobile-first private knowledge library that enables users to save short-form video content (TikTok videos, Instagram Reels, YouTube Shorts) into a searchable personal archive. The system processes saved content asynchronously, enriching it with AI-powered metadata extraction and categorization while maintaining a calm, private-library user experience. The platform consists of a React Native mobile application, Node.js backend API, background worker service, and Supabase-powered data layer with RevenueCat subscription management.

## Glossary

- **Mobile_App**: The React Native iOS and Android application that provides the user interface
- **Backend_API**: The Node.js Fastify server handling REST API requests
- **Background_Worker**: The Node.js service processing asynchronous enrichment jobs
- **Database**: The Supabase Postgres database with row-level security
- **Queue**: The pg-boss job queue backed by Postgres
- **Save_Item**: A user-saved video record stored in the videos table
- **Processing_State**: The current status of async enrichment (queued, fetching_metadata, analyzing, completed, failed)
- **Metadata_Parser**: Platform-specific service extracting video metadata from source URLs
- **AI_Categorizer**: Service analyzing metadata to produce summaries, tags, and structured fields
- **Collection**: User-created grouping of saved items (manual or smart)
- **Smart_Collection**: Collection with rule-based automatic membership
- **Vertical_Type**: Content category (recipe, workout, tutorial_diy, beauty_fashion, education, entertainment, general)
- **Search_Index**: Combined searchable text field in videos table
- **Entitlement_Service**: RevenueCat integration managing subscription state
- **Masonry_Grid**: Pinterest-style thumbnail layout for browsing
- **Share_Target**: Native mobile share extension for saving content
- **Embed_Container**: WebView component rendering in-app video playback

## Requirements

### Requirement 1: Content Saving

**User Story:** As a user, I want to save short-form video URLs from TikTok, Instagram, and YouTube into my private library, so that I can build a searchable personal knowledge archive.

#### Acceptance Criteria

1. WHEN a user submits a TikTok video URL through the Mobile_App, THE Backend_API SHALL validate the URL format and create a Save_Item record within 1 second
2. WHEN a user submits an Instagram Reel URL through the Mobile_App, THE Backend_API SHALL validate the URL format and create a Save_Item record within 1 second
3. WHEN a user submits a YouTube Short URL through the Mobile_App, THE Backend_API SHALL validate the URL format and create a Save_Item record within 1 second
4. WHEN a Save_Item record is created, THE Backend_API SHALL normalize the URL by removing tracking parameters and converting mobile variants to canonical form
5. WHEN a Save_Item record is created, THE Backend_API SHALL set the Processing_State to queued
6. WHEN a Save_Item record is created, THE Backend_API SHALL enqueue a fetch_metadata job in the Queue
7. WHEN the Backend_API receives an unsupported URL format, THE Backend_API SHALL return an error response indicating the platform is not supported
8. WHEN a user attempts to save a duplicate normalized URL, THE Backend_API SHALL return the existing Save_Item identifier
9. THE Mobile_App SHALL provide a floating save button accessible from the home screen
10. THE Mobile_App SHALL provide a paste URL input field for manual URL entry
11. WHEN a user shares a video URL from TikTok using the native share menu, THE Share_Target SHALL capture the URL and open the Mobile_App
12. WHEN a user shares a video URL from Instagram using the native share menu, THE Share_Target SHALL capture the URL and open the Mobile_App
13. WHEN a user shares a video URL from YouTube using the native share menu, THE Share_Target SHALL capture the URL and open the Mobile_App

### Requirement 2: Metadata Extraction

**User Story:** As a user, I want the system to automatically extract video information from saved URLs, so that my library contains rich searchable metadata without manual data entry.

#### Acceptance Criteria

1. WHEN a fetch_metadata job is processed, THE Background_Worker SHALL invoke the Metadata_Parser for the platform specified in the Save_Item
2. WHEN the Metadata_Parser extracts metadata, THE Background_Worker SHALL store the title in the Save_Item within 10 seconds
3. WHEN the Metadata_Parser extracts metadata, THE Background_Worker SHALL store the creator name and creator handle in the Save_Item within 10 seconds
4. WHEN the Metadata_Parser extracts metadata, THE Background_Worker SHALL store the description or caption in the Save_Item within 10 seconds
5. WHEN the Metadata_Parser extracts metadata, THE Background_Worker SHALL store hashtags as JSON in the Save_Item within 10 seconds
6. WHEN the Metadata_Parser extracts metadata, THE Background_Worker SHALL store the thumbnail URL in the Save_Item within 10 seconds
7. WHEN the Metadata_Parser extracts metadata, THE Background_Worker SHALL store the embed URL or embed HTML in the Save_Item within 10 seconds
8. WHEN the Metadata_Parser extracts metadata, THE Background_Worker SHALL store the duration in seconds in the Save_Item within 10 seconds
9. WHEN the Metadata_Parser extracts metadata, THE Background_Worker SHALL store the detected language in the Save_Item within 10 seconds
10. WHEN metadata extraction completes successfully, THE Background_Worker SHALL update the Processing_State to analyzing
11. WHEN metadata extraction completes successfully, THE Background_Worker SHALL enqueue an analyze_video job in the Queue
12. IF metadata extraction fails after 3 retry attempts, THEN THE Background_Worker SHALL update the Processing_State to failed and store the error message
13. WHEN metadata extraction produces partial results, THE Background_Worker SHALL store the available fields and continue to the analyze_video job
14. THE Metadata_Parser SHALL use platform-specific parsing logic isolated per source
15. THE Metadata_Parser SHALL not download video files or audio tracks

### Requirement 3: AI Categorization

**User Story:** As a Pro subscriber, I want the system to automatically categorize and summarize my saved videos using AI analysis of metadata, so that I can find and organize content more effectively.

#### Acceptance Criteria

1. WHEN an analyze_video job is processed for a Pro subscriber, THE Background_Worker SHALL invoke the AI_Categorizer with the Save_Item metadata
2. WHEN the AI_Categorizer processes metadata, THE AI_Categorizer SHALL generate a summary limited to 200 characters
3. WHEN the AI_Categorizer processes metadata, THE AI_Categorizer SHALL identify the primary topic
4. WHEN the AI_Categorizer processes metadata, THE AI_Categorizer SHALL identify the content format
5. WHEN the AI_Categorizer processes metadata, THE AI_Categorizer SHALL identify the creator intent
6. WHEN the AI_Categorizer processes metadata, THE AI_Categorizer SHALL identify the target audience
7. WHEN the AI_Categorizer processes metadata, THE AI_Categorizer SHALL assign a Vertical_Type from the defined taxonomy
8. WHEN the AI_Categorizer processes metadata, THE AI_Categorizer SHALL generate 3 to 10 suggested tags
9. WHEN the AI_Categorizer processes metadata, THE AI_Categorizer SHALL assign a quality score between 0 and 100
10. WHEN the AI_Categorizer assigns Vertical_Type as recipe, THE AI_Categorizer SHALL extract structured fields including ingredients, cuisine, meal_type, cooking_method, diet_type, and equipment when present in metadata
11. WHEN the AI_Categorizer assigns Vertical_Type as workout, THE AI_Categorizer SHALL extract structured fields including muscle_group, workout_type, equipment, intensity, skill_level, and goal when present in metadata
12. WHEN the AI_Categorizer assigns Vertical_Type as tutorial_diy, THE AI_Categorizer SHALL extract structured fields including tools, materials, skill_level, domain, and end_result when present in metadata
13. WHEN the AI_Categorizer assigns Vertical_Type as beauty_fashion, THE AI_Categorizer SHALL extract structured fields including product_type, style, occasion, brand_mentions, and aesthetic when present in metadata
14. WHEN AI analysis completes successfully, THE Background_Worker SHALL store results in the video_analysis table
15. WHEN AI analysis completes successfully, THE Background_Worker SHALL update the Processing_State to completed
16. WHEN AI analysis completes successfully, THE Background_Worker SHALL enqueue an index_video job in the Queue
17. IF AI analysis fails after 3 retry attempts, THEN THE Background_Worker SHALL update the Processing_State to failed and store the error message
18. THE AI_Categorizer SHALL use text metadata only as input
19. THE AI_Categorizer SHALL not use video transcription or audio analysis
20. THE AI_Categorizer SHALL return structured JSON output matching the defined schema

### Requirement 4: Search Indexing

**User Story:** As a user, I want all metadata and AI analysis to be indexed for search, so that I can find saved videos by any relevant information.

#### Acceptance Criteria

1. WHEN an index_video job is processed, THE Background_Worker SHALL combine the title, creator name, creator handle, caption, description, hashtags, summary, AI tags, user tags, and vertical fields into the Search_Index
2. WHEN the Search_Index is updated, THE Background_Worker SHALL update the videos table search_text field within 5 seconds
3. WHEN a user adds a manual tag to a Save_Item, THE Backend_API SHALL enqueue an index_video job in the Queue
4. WHEN a user adds a Save_Item to a Collection, THE Background_Worker SHALL include the Collection name in the Search_Index
5. THE Search_Index SHALL support full-text search using Postgres full-text capabilities
6. THE Search_Index SHALL support fuzzy matching using pg_trgm extension

### Requirement 5: Library Browsing

**User Story:** As a user, I want to browse my saved videos in a visual masonry grid layout, so that I can quickly scan and recognize content by thumbnails.

#### Acceptance Criteria

1. THE Mobile_App SHALL display saved videos on the home screen using a Masonry_Grid layout
2. WHEN a user opens the home screen, THE Mobile_App SHALL load the 50 most recent Save_Item records
3. WHEN a Save_Item card is rendered in the Masonry_Grid, THE Mobile_App SHALL display the thumbnail, creator name, platform icon, title, AI tags, summary, and relative saved time
4. WHEN a Save_Item has Processing_State other than completed, THE Mobile_App SHALL display a processing indicator on the card
5. WHEN a user scrolls to the bottom of the Masonry_Grid, THE Mobile_App SHALL load the next 50 Save_Item records
6. THE Mobile_App SHALL provide quick filter buttons for All, TikTok, Instagram, YouTube, Recipes, Workouts, DIY, and Education
7. WHEN a user selects a quick filter, THE Mobile_App SHALL reload the Masonry_Grid showing only matching Save_Item records
8. WHEN a user has processing jobs in progress, THE Mobile_App SHALL display a processing queue preview section above the Masonry_Grid
9. WHEN a user taps the processing queue preview, THE Mobile_App SHALL navigate to the full processing queue screen

### Requirement 6: Processing Queue Visibility

**User Story:** As a user, I want to see the status of videos being processed, so that I understand when my saved content will be ready to search and organize.

#### Acceptance Criteria

1. THE Mobile_App SHALL provide a processing queue screen listing all Save_Item records with Processing_State other than completed or failed
2. WHEN a Save_Item is in the processing queue, THE Mobile_App SHALL display the thumbnail, source URL, Processing_State, and elapsed time since save
3. WHEN the Processing_State is queued, THE Mobile_App SHALL display the status label "Queued"
4. WHEN the Processing_State is fetching_metadata, THE Mobile_App SHALL display the status label "Fetching Metadata"
5. WHEN the Processing_State is analyzing, THE Mobile_App SHALL display the status label "Analyzing"
6. WHEN the Processing_State is failed, THE Mobile_App SHALL display the status label "Failed" and the error message
7. WHEN a Save_Item Processing_State updates, THE Mobile_App SHALL refresh the queue display within 5 seconds
8. WHEN a user taps a failed Save_Item in the queue, THE Mobile_App SHALL provide a retry option
9. WHEN a user taps retry on a failed Save_Item, THE Backend_API SHALL enqueue a new fetch_metadata job in the Queue

### Requirement 7: Video Detail View

**User Story:** As a user, I want to view comprehensive information about a saved video including metadata, AI analysis, and playback options, so that I can review and organize my content effectively.

#### Acceptance Criteria

1. WHEN a user taps a Save_Item card, THE Mobile_App SHALL navigate to the video detail screen
2. THE video detail screen SHALL display the thumbnail, platform icon, creator name, and creator handle in the header
3. WHEN AI analysis is available, THE video detail screen SHALL display the summary section
4. THE video detail screen SHALL display the title, caption, description, and hashtags in the metadata section
5. WHEN AI analysis is available, THE video detail screen SHALL display the topic, intent, audience, and quality score in the AI analysis section
6. WHEN Vertical_Type fields are available, THE video detail screen SHALL display the structured fields in a vertical-specific section
7. THE video detail screen SHALL display user-editable tags in the editable data section
8. THE video detail screen SHALL display Collection memberships in the editable data section
9. THE video detail screen SHALL provide an "Open Original" link to the source URL
10. WHEN the platform supports embedded playback, THE Embed_Container SHALL attempt to render the embed on the video detail screen
11. IF the embed cannot be rendered, THEN THE Mobile_App SHALL display the thumbnail and "Open Original" link
12. WHEN a user taps the "Open Original" link, THE Mobile_App SHALL open the source URL in the system browser

### Requirement 8: Search

**User Story:** As a user, I want to search my saved videos by any text content, so that I can quickly find specific items in my library.

#### Acceptance Criteria

1. THE Mobile_App SHALL provide a search tab with a search bar
2. WHEN a user enters a search query, THE Mobile_App SHALL send the query to the Backend_API
3. WHEN the Backend_API receives a search query, THE Backend_API SHALL query the Search_Index using Postgres full-text search
4. WHEN the Backend_API executes a search query, THE Backend_API SHALL return results within 2 seconds
5. WHEN search results are returned, THE Mobile_App SHALL display matching Save_Item records in a Masonry_Grid layout
6. WHEN a Save_Item matches the search query, THE result card SHALL highlight the matched field
7. THE Mobile_App SHALL display recent searches below the search bar
8. THE Mobile_App SHALL provide suggested filters for Recipes, Education, and DIY below the search bar
9. WHEN a user taps a suggested filter, THE Mobile_App SHALL execute a search for that filter term

### Requirement 9: Advanced Filters

**User Story:** As a user, I want to filter my library by platform, content type, language, creator, and collection, so that I can narrow down search results to specific categories.

#### Acceptance Criteria

1. THE Mobile_App SHALL provide an advanced filters screen accessible from the search tab
2. THE advanced filters screen SHALL provide a platform filter with options for TikTok, Instagram, and YouTube
3. THE advanced filters screen SHALL provide a content type filter with options for Recipe, Workout, DIY, Beauty, Education, and Entertainment
4. THE advanced filters screen SHALL provide a language filter with options for English, Spanish, and French
5. THE advanced filters screen SHALL provide a creator search field
6. THE advanced filters screen SHALL provide a collections filter listing all user collections
7. WHEN a user applies filters, THE Backend_API SHALL query the Database using indexed structured fields
8. WHEN a user applies multiple filters, THE Backend_API SHALL combine filters using AND logic
9. WHEN filtered results are returned, THE Mobile_App SHALL display matching Save_Item records in a Masonry_Grid layout

### Requirement 10: Manual Collections

**User Story:** As a user, I want to create named collections and manually add saved videos to them, so that I can organize my library into custom categories.

#### Acceptance Criteria

1. THE Mobile_App SHALL provide a collections tab displaying all user collections
2. WHEN a user creates a manual collection, THE Mobile_App SHALL prompt for name and icon selection
3. WHEN a user creates a manual collection, THE Backend_API SHALL create a Collection record with type set to manual
4. WHEN a user opens a Collection, THE Mobile_App SHALL display member Save_Item records in a Masonry_Grid layout
5. THE Collection detail screen SHALL display the collection name, description, and video count
6. THE Collection detail screen SHALL provide sort options for recent, oldest, creator, and platform
7. WHEN a user taps "Add to Collection" on a Save_Item card, THE Mobile_App SHALL display a multi-select modal listing all collections
8. WHEN a user selects collections in the modal, THE Backend_API SHALL create collection_videos join records
9. WHEN a user removes a Save_Item from a Collection, THE Backend_API SHALL delete the collection_videos join record
10. WHEN a user deletes a Collection, THE Backend_API SHALL delete the Collection record and all collection_videos join records

### Requirement 11: Smart Collections

**User Story:** As a Pro subscriber, I want to create rule-based collections that automatically include matching videos, so that my library organizes itself based on content attributes.

#### Acceptance Criteria

1. WHERE the user is a Pro subscriber, THE Mobile_App SHALL provide a "Create Smart Collection" option
2. WHEN a Pro subscriber creates a Smart_Collection, THE Mobile_App SHALL display the smart collection builder
3. THE smart collection builder SHALL provide rule options for "tag contains", "topic equals", "creator equals", and "platform equals"
4. WHEN a Pro subscriber saves a Smart_Collection with rules, THE Backend_API SHALL create a Collection record with type set to smart and store rules as JSON
5. WHEN an index_video job completes, THE Background_Worker SHALL enqueue a refresh_smart_collections job in the Queue
6. WHEN a refresh_smart_collections job is processed, THE Background_Worker SHALL evaluate all Smart_Collection rules against the updated Save_Item
7. WHEN a Save_Item matches a Smart_Collection rule, THE Background_Worker SHALL create a collection_videos join record
8. WHEN a Save_Item no longer matches a Smart_Collection rule, THE Background_Worker SHALL delete the collection_videos join record
9. WHERE the user is a Free subscriber, THE Mobile_App SHALL display the smart collection feature behind a paywall

### Requirement 12: User Tags

**User Story:** As a user, I want to add custom tags to saved videos, so that I can apply my own organization system beyond AI-generated tags.

#### Acceptance Criteria

1. THE video detail screen SHALL provide an editable tags field
2. WHEN a user adds a tag, THE Backend_API SHALL create a video_tags record with source set to user
3. WHEN a user removes a tag, THE Backend_API SHALL delete the video_tags record
4. WHEN a user saves a tag change, THE Backend_API SHALL enqueue an index_video job to update the Search_Index
5. THE Mobile_App SHALL display user tags and AI tags with visual distinction on the video detail screen
6. THE Mobile_App SHALL normalize tag text to lowercase with underscores replacing spaces

### Requirement 13: Authentication

**User Story:** As a user, I want to securely sign in to my account, so that my saved content remains private and accessible only to me.

#### Acceptance Criteria

1. THE Mobile_App SHALL provide sign-in and sign-up screens
2. WHEN a user signs up, THE Mobile_App SHALL submit credentials to Supabase Auth
3. WHEN a user signs in, THE Mobile_App SHALL submit credentials to Supabase Auth
4. WHEN authentication succeeds, THE Mobile_App SHALL store the session token securely
5. WHEN the Mobile_App makes API requests, THE Mobile_App SHALL include the session token in the Authorization header
6. THE Backend_API SHALL validate session tokens on all protected endpoints
7. THE Mobile_App SHALL provide a forgot password flow using Supabase Auth password reset
8. WHEN a user is not authenticated and attempts to share a URL, THE Mobile_App SHALL store the URL and prompt for authentication before saving

### Requirement 14: Subscription Management

**User Story:** As a user, I want to upgrade to a Pro subscription to unlock AI categorization and smart collections, so that I can enhance my library organization capabilities.

#### Acceptance Criteria

1. THE Mobile_App SHALL display the user's current plan on the profile tab
2. THE profile tab SHALL display usage counters for saves and AI analyses
3. WHEN a Free subscriber accesses a Pro feature, THE Mobile_App SHALL display a paywall screen
4. THE paywall screen SHALL explain Pro features including unlimited saves, AI summaries, AI tags, and smart collections
5. WHEN a user taps the upgrade button, THE Mobile_App SHALL invoke RevenueCat checkout
6. WHEN RevenueCat checkout completes successfully, THE Entitlement_Service SHALL sync the subscription state to the Database
7. WHEN the Backend_API receives an entitlement webhook from RevenueCat, THE Backend_API SHALL update the subscriptions table
8. THE Backend_API SHALL enforce save quotas based on subscription state
9. THE Backend_API SHALL enforce AI analysis quotas based on subscription state
10. WHERE the user is a Free subscriber, THE Backend_API SHALL skip AI analysis jobs and set Processing_State to completed after metadata fetch
11. THE Mobile_App SHALL provide a "Manage Subscription" link that opens RevenueCat subscription management

### Requirement 15: Profile and Settings

**User Story:** As a user, I want to manage my account settings, preferences, and data, so that I can customize my experience and maintain control over my information.

#### Acceptance Criteria

1. THE Mobile_App SHALL provide a profile tab displaying user name, email, and plan
2. THE profile tab SHALL provide navigation to subscription, settings, help, and privacy screens
3. THE settings screen SHALL provide options for account email, password, default sort preference, language, and notifications
4. THE settings screen SHALL provide an "Export Data" option
5. WHEN a user taps "Export Data", THE Backend_API SHALL generate a JSON export of all Save_Item records and Collection records within 30 seconds
6. THE settings screen SHALL provide a "Delete Account" option
7. WHEN a user confirms account deletion, THE Backend_API SHALL delete all user records from the Database
8. THE settings screen SHALL provide notification preferences for processing complete, subscription updates, and feature announcements
9. THE help screen SHALL provide FAQ, contact support, and report bug options

### Requirement 16: Row-Level Security

**User Story:** As a system operator, I want all user data to be isolated at the database level, so that users can only access their own content and unauthorized access is prevented by design.

#### Acceptance Criteria

1. THE Database SHALL enforce row-level security policies on the videos table
2. THE Database SHALL enforce row-level security policies on the collections table
3. THE Database SHALL enforce row-level security policies on the collection_videos table
4. THE Database SHALL enforce row-level security policies on the video_tags table
5. THE Database SHALL enforce row-level security policies on the video_analysis table
6. WHEN a user queries the videos table, THE Database SHALL return only rows where user_id matches the authenticated user
7. WHEN a user queries the collections table, THE Database SHALL return only rows where user_id matches the authenticated user
8. THE Backend_API SHALL use service-role credentials for background worker operations
9. THE Mobile_App SHALL never receive service-role credentials

### Requirement 17: Job Processing Reliability

**User Story:** As a system operator, I want background jobs to be idempotent and retryable, so that transient failures do not result in data loss or inconsistent state.

#### Acceptance Criteria

1. WHEN a job fails, THE Queue SHALL retry the job up to 3 times
2. WHEN a job is retried, THE Background_Worker SHALL not duplicate work already completed
3. WHEN metadata fetch succeeds but AI analysis fails, THE Background_Worker SHALL preserve the fetched metadata
4. WHEN a job exceeds the retry limit, THE Background_Worker SHALL update the Processing_State to failed
5. THE Background_Worker SHALL record attempt count in the processing_jobs table
6. THE Background_Worker SHALL record error messages in the processing_jobs table
7. THE Background_Worker SHALL record job start and completion timestamps in the processing_jobs table

### Requirement 18: API Rate Limiting

**User Story:** As a system operator, I want API endpoints to enforce rate limits, so that system resources are protected from abuse and excessive usage.

#### Acceptance Criteria

1. THE Backend_API SHALL limit save requests to 100 per hour per user
2. THE Backend_API SHALL limit search requests to 1000 per hour per user
3. WHEN a rate limit is exceeded, THE Backend_API SHALL return a 429 status code
4. WHEN a rate limit is exceeded, THE Backend_API SHALL include a Retry-After header in the response

### Requirement 19: URL Validation and Security

**User Story:** As a system operator, I want all incoming URLs to be validated and sanitized, so that malicious input cannot compromise the system or user data.

#### Acceptance Criteria

1. WHEN the Backend_API receives a save request, THE Backend_API SHALL validate that the URL uses HTTPS protocol
2. WHEN the Backend_API receives a save request, THE Backend_API SHALL validate that the URL domain matches TikTok, Instagram, or YouTube domains
3. WHEN the Backend_API receives a save request, THE Backend_API SHALL sanitize the URL to prevent script injection
4. IF URL validation fails, THEN THE Backend_API SHALL return a 400 status code with a descriptive error message

### Requirement 20: Performance Monitoring

**User Story:** As a system operator, I want to track processing times and completion rates, so that I can identify performance issues and optimize the system.

#### Acceptance Criteria

1. WHEN a save request completes, THE Backend_API SHALL log the response time
2. WHEN a metadata fetch job completes, THE Background_Worker SHALL log the duration
3. WHEN an AI analysis job completes, THE Background_Worker SHALL log the duration
4. WHEN a search request completes, THE Backend_API SHALL log the response time and result count
5. THE Backend_API SHALL record usage events in the usage_events table for saves, searches, AI analyses, and upgrades
