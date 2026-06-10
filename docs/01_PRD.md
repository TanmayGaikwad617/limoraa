# ContentCategorize - Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** June 2026  
**Status:** Draft  
**Owner:** Founder  

---

## 1. Product Summary

ContentCategorize is a private knowledge library for short-form content. Users save TikTok videos, Instagram Reels, and YouTube Shorts into a calm, searchable personal archive that feels closer to Apple Notes, Spotify Library, MyMind, and Pinterest boards than a social app.

The product is not a content network. It is a personal system for remembering what mattered in the endless stream.

**Core positioning**
- Private by default
- Personal library, not public profile
- Save first, organize later
- Searchable knowledge, not entertainment feed
- Mobile first

**Platforms**
- iOS
- Android

**Business Model**
- Free plan with usage limits
- Pro subscription for AI summaries, categorization, and smart organization

---

## 2. Product Principles

### What the app should feel like
- Calm
- Personal
- Useful in under a minute
- Structured without being rigid
- Designed for ownership, not performance
- Visual first

### What the app should not feel like
- A social feed
- A discovery engine
- A creator marketplace
- A trend dashboard
- A productivity tool overloaded with admin workflows

### Explicit product boundaries
- No feed
- No discovery tab
- No likes
- No followers
- No public content
- No social graph

---

## 3. Problem Statement

People save valuable short-form content across TikTok, Instagram, and YouTube, but those saves are fragmented, hard to search, and easy to lose inside algorithmic products.

Current platform saves are weak because:
- Saved content is locked inside each platform
- Search across saved videos is poor or nonexistent
- Users cannot reliably organize saved content into a private knowledge system
- Important metadata is buried in captions, hashtags, and creator context
- Most products optimize for watching more, not remembering more

ContentCategorize solves this by turning a shared link into a structured, searchable, private library item.

---

## 4. Goals and Success Criteria

### Product Goals
1. Let a user save a supported URL in one action from mobile
2. Make saved content easy to retrieve by search, filters, tags, and collections
3. Help users build a dependable personal knowledge archive, not just a pile of links
4. Make async processing understandable and trustworthy
5. Keep the interface emotionally quiet and utility-first

### Success Criteria
1. Most saves reach searchable state in under 15 seconds
2. Users can find content by title, creator, hashtags, summary, tags, and vertical fields
3. Users understand whether a saved item is queued, processing, ready, or failed
4. Pro features increase perceived value through better organization, not forced complexity

---

## 5. Non-Goals (v1)

- Public profiles
- Shared libraries
- Collaboration
- Social posting
- Content discovery recommendations
- Trend tracking
- Full video downloads for archival
- Transcript-dependent product positioning
- Desktop-first workflows

---

## 6. Primary User

### The Private Collector
- Saves useful short-form content constantly
- Wants to revisit ideas, recipes, workouts, DIY guides, and educational clips later
- Feels current save systems are chaotic and hard to trust
- Cares more about retrieval and organization than social features
- Wants the app to feel personal, quiet, and premium

---

## 7. Information Architecture

### Main Tabs

**Home**
- Home
- Processing Queue
- Save Content
- Video Detail

**Search**
- Search
- Search Results
- Advanced Filters

**Collections**
- Collections Home
- Collection Detail
- Create Collection
- Smart Collection Builder
- Add To Collection

**Profile**
- Profile
- Subscription
- Settings
- Notifications
- Help and Support

### Global Flows
- Authentication
- Share Target
- Paywall

---

## 8. Core Screens and Requirements

### 8.1 Home Tab

**Primary purpose:**  
View, save, and manage recently saved content.

**Home screen sections**
- Search shortcut
- Quick filters
- Recent saves
- Processing queue preview
- Library grid
- Floating save button

**Header**
- Greeting such as "Good morning, Christ"
- Saved count
- Collection count
- Primary add action

**Quick filters**
- All
- TikTok
- Instagram
- YouTube
- Recipes
- Workouts
- DIY
- Education

**Processing section**
- Only visible when jobs are running
- Shows count and tap-through to full queue

**Library card requirements**
- Thumbnail
- Creator
- Platform
- Title
- Tags
- Summary
- Relative saved time
- Processing state when applicable
- Actions:
  - Open
  - Add to Collection
  - Edit Tags
  - Delete

**Layout requirement**
- The default library presentation should be a Pinterest-style masonry thumbnail grid, not a text-heavy vertical feed
- Cards should feel like saved visual objects inside a private board

---

### 8.2 Processing Queue

**Primary purpose:**  
Make async work legible and trustworthy.

**Statuses**
- Queued
- Fetching Metadata
- Analyzing
- Failed
- Completed

The queue exists because processing is asynchronous and the user should never wonder whether the save worked.

---

### 8.3 Save Content

**Entry points**
- Floating save button
- Paste URL
- Native share target

**Save flow**
- Paste link
- Validate URL
- Show preview before save
- Confirm save

**Preview fields**
- Creator
- Thumbnail
- Platform
- Source URL

---

### 8.4 Video Detail

**Primary purpose:**  
Serve as the single source of truth for a saved item.

**Sections**

**Header**
- Thumbnail
- Platform
- Creator

**Summary**
- AI summary

**Metadata**
- Title
- Caption
- Description
- Hashtags

**AI Analysis**
- Topic
- Intent
- Audience
- Quality score

**Vertical Fields**

Recipe examples:
- Ingredients
- Cuisine
- Meal type

Workout examples:
- Equipment
- Intensity
- Goal

**Editable data**
- User tags
- Collections

**Source**
- Open original video

---

### 8.5 Search Tab

**Primary purpose:**  
Find saved content instantly.

**Search screen**
- Search bar
- Recent searches
- Suggested filters
- Results

**Search scope**
- Title
- Creator
- Hashtags
- Description
- Summary
- Tags

**Suggested filters**
- Recipes
- Education
- DIY

**Result card**
- Thumbnail
- Title
- Creator
- Matched tag or field

**Results layout**
- Search results should reuse the same masonry grid language as Home and Collections whenever possible

---

### 8.6 Advanced Filters

**Available filters**

**Platform**
- TikTok
- Instagram
- YouTube

**Content Type**
- Recipe
- Workout
- DIY
- Beauty
- Education
- Entertainment

**Language**
- English
- Spanish
- French

**Creator**
- Search by creator

**Collections**
- Filter by collection

---

### 8.7 Collections Tab

**Primary purpose:**  
Organize personal knowledge.

**Collections home**

**Manual collections**
- Example: Business Ideas
- Example: Healthy Recipes
- Example: Gym

**Smart collections**
- Example: AI Tools
- Example: Meal Prep
- Example: Productivity

**Collection detail**
- Name
- Description
- Video count
- Saved videos masonry grid
- Sort by recent, oldest, creator, platform

**Create collection**
- Manual:
  - Name
  - Icon
- Smart:
  - Name
  - Rules

**Smart collection builder rules**
- Tag contains
- Topic equals
- Creator equals
- Platform equals

**Add to collection modal**
- Multi-select collections

---

### 8.8 Profile Tab

**Primary purpose:**  
Account, billing, and settings.

**Profile**
- User card
- Name
- Email
- Plan

**Usage**
- Save quota
- AI analysis quota

**Upgrade card**
- Unlock AI categorization

**Quick actions**
- Manage subscription
- Settings
- Help
- Privacy

**Subscription screen**

Free
- 100 saves
- Basic search

Pro
- Unlimited saves
- AI summaries
- AI tags
- Smart collections

**Settings**
- Account
- Email
- Password
- Delete account
- Default sort
- Language
- Notifications
- Export data
- Delete data

**Notifications**
- Processing complete
- Subscription updates
- Feature announcements

**Help and Support**
- FAQ
- Contact support
- Report bug

---

## 9. Playback and Embed Strategy

### Core rule
- Browsing surfaces should be thumbnail-first
- Playback should happen on the detail screen

### Detail screen behavior
- Try in-app embed first when the platform supports it
- Fall back to thumbnail, metadata, and "Open original" when embed is unavailable or blocked

### Platform expectations for v1
- YouTube: embedded player supported in-app
- Instagram Reels: support public embeds when available
- TikTok: support embeds when available

### Why this approach
- Keeps the main library fast and visually clean
- Preserves the Pinterest-like feeling of saved boards
- Avoids turning the home screen into a wall of active players
- Handles platform variability safely

---

## 10. Hidden Flows

### Authentication
- Splash
- Onboarding
- Sign in
- Sign up
- Forgot password

### Share Target Flow
- Share from TikTok, Instagram, or YouTube
- Route into app
- Show saving state
- Open app into saved item or queue state

### Paywall Flow
- Upgrade prompt
- Feature explanation
- RevenueCat checkout
- Success state

---

## 11. UX Requirements

### Design Direction
- Calm surfaces
- Soft hierarchy
- Minimal noise
- Strong typography
- Shelf and library metaphors over feed metaphors
- Masonry thumbnail layouts over dense list views

### Interaction Principles
- Search should feel immediate
- Save should feel reassuring
- Processing should feel transparent
- Organization should feel optional, not mandatory
- AI should support clarity, not dominate the screen
- Thumbnails should do most of the browsing work

### Tone
- Personal, not performative
- Intelligent, not robotic
- Premium, not flashy

---

## 12. Monetization Summary

### Free
- Limited saves
- Basic search
- Manual collections

### Pro
- Higher or unlimited save limits
- AI summary
- AI categorization
- Smart collections
- Advanced filters

RevenueCat manages subscription state and entitlements.

---

## 13. Launch Acceptance Criteria

The product is ready for v1 when:

1. A user can save a TikTok, Reel, or Short from mobile
2. The save appears immediately in the library with a visible processing state
3. Most items become searchable within the expected async window
4. Search works across metadata, summaries, tags, and structured fields
5. Users can organize items into manual and smart collections
6. The experience feels like a private library rather than a social product
