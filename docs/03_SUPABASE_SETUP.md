# Supabase Setup

Use this checklist with the schema in [`supabase/schema.sql`](../supabase/schema.sql).

## 1. Create the project

- Create a new Supabase project.
- Copy the `Project URL` and the `anon` key for the mobile app later.
- Keep the `service_role` key only for your backend or worker, never in the Expo app.

## 2. Enable the database features

In **Database > Extensions**, make sure these are enabled:

- `pgcrypto`
- `pg_trgm`
- `unaccent`

The SQL file also creates them, so this step is mostly a quick verification.

## 3. Run the schema

In **SQL Editor**, run `supabase/schema.sql`.

That script creates:

- `profiles`
- `videos`
- `video_tags`
- `video_analysis`
- `collections`
- `collection_videos`
- `processing_jobs`
- `usage_events`
- `subscriptions`

It also:

- creates enums for platforms, statuses, collections, jobs, and plans
- enables RLS on every app table
- adds the basic owner-only policies
- creates the auth trigger that auto-creates a profile row for new users
- adds indexes for library browsing and search

## 4. Configure Auth

Go to **Authentication > Providers** and enable:

- Email login, if you want password or magic-link sign-in
- Apple and Google later, if you decide to support them

For a mobile-first Expo app, also configure:

- **Authentication > URL Configuration**
- add your app callback URL to the redirect allow-list
- set the site URL for any web surface you add later

Important: the current Expo app does not define a custom scheme yet, so add one before you rely on deep-link auth redirects. A common pattern is `contentcategorize://auth/callback`.

## 5. Configure Storage only if you need it

You do not need Storage for the core v1 database.

If you later cache thumbnails or exports, create a **private** file bucket such as:

- `app-assets`
- or `exports`

Use signed URLs instead of a public bucket.

## 6. Realtime is optional

You can skip Realtime at first.

Enable it only if you want live queue updates in the client for tables like:

- `videos`
- `processing_jobs`
- `collections`
- `collection_videos`

## 7. What the schema expects from your app

- The client should use the `anon` key only.
- Your backend or worker should use the `service_role` key.
- The backend should populate `search_text` when it writes or enriches a video.
- The app should read the current user through Supabase Auth, then query rows owned by that user.

## 8. Good first checks in the dashboard

- Create a test user and confirm a `profiles` row appears automatically.
- Save a sample video row and confirm RLS hides it from other users.
- Check that the `videos_search_text_idx` and trigram indexes exist.
- Verify `Authentication > Redirect URLs` includes the callback URL you will use in the app.

