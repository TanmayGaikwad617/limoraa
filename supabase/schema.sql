-- ContentCategorize Supabase schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

do $$
begin
  create type public.subscription_plan as enum ('free', 'pro');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.platform_type as enum ('tiktok', 'instagram', 'youtube');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_type as enum (
    'recipe',
    'workout',
    'tutorial_diy',
    'beauty_fashion',
    'education',
    'entertainment',
    'general'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.video_status as enum (
    'queued',
    'fetching_metadata',
    'analyzing',
    'ready',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.step_status as enum (
    'queued',
    'processing',
    'completed',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.collection_type as enum ('manual', 'smart');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.tag_source as enum ('user', 'ai');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.job_type as enum (
    'fetch_metadata',
    'analyze_video',
    'index_video',
    'refresh_smart_collections'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'canceled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.usage_event_type as enum (
    'save',
    'search',
    'ai',
    'quota',
    'billing',
    'upgrade'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  display_name text not null default 'Collector',
  avatar_url text,
  plan public.subscription_plan not null default 'free',
  monthly_save_count integer not null default 0,
  monthly_ai_count integer not null default 0,
  monthly_save_limit integer not null default 100,
  monthly_ai_limit integer not null default 25,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_url text not null,
  normalized_url text not null,
  platform public.platform_type not null,
  platform_video_id text,
  content_type public.content_type,
  title text,
  description text,
  caption text,
  hashtags_json jsonb not null default '[]'::jsonb,
  creator_name text,
  creator_handle text,
  thumbnail_url text,
  embed_url text,
  embed_html text,
  duration_seconds integer,
  language_code text,
  status public.video_status not null default 'queued',
  metadata_status public.step_status not null default 'queued',
  analysis_status public.step_status not null default 'queued',
  summary text,
  search_text text not null default '',
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint videos_duration_seconds_check check (duration_seconds is null or duration_seconds >= 0),
  constraint videos_unique_normalized_url unique (user_id, normalized_url)
);

create table if not exists public.video_tags (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  tag text not null,
  source public.tag_source not null default 'user',
  created_at timestamptz not null default now(),
  constraint video_tags_unique unique (video_id, tag, source)
);

create table if not exists public.video_analysis (
  video_id uuid primary key references public.videos (id) on delete cascade,
  topic text,
  format text,
  intent text,
  audience text,
  vertical_type public.content_type,
  quality_score numeric(5,2),
  tags_json jsonb not null default '[]'::jsonb,
  vertical_fields_json jsonb not null default '{}'::jsonb,
  analysis_version integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  type public.collection_type not null default 'manual',
  icon text,
  rules_json jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_user_name_unique unique (user_id, name)
);

create table if not exists public.collection_videos (
  collection_id uuid not null references public.collections (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, video_id)
);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  job_type public.job_type not null,
  status public.job_status not null default 'queued',
  attempt_count integer not null default 0,
  error_message text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type public.usage_event_type not null,
  resource_type text,
  resource_id uuid,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'revenuecat',
  entitlement_id text,
  product_id text,
  subscription_status text not null default 'inactive',
  plan public.subscription_plan not null default 'free',
  original_app_user_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_user_unique unique (user_id)
);

create index if not exists videos_user_saved_at_idx
  on public.videos (user_id, saved_at desc);

create index if not exists videos_user_status_idx
  on public.videos (user_id, status);

create index if not exists videos_user_platform_idx
  on public.videos (user_id, platform);

create index if not exists videos_user_content_type_idx
  on public.videos (user_id, content_type);

create index if not exists videos_search_text_idx
  on public.videos using gin (to_tsvector('english', search_text));

create index if not exists videos_title_trgm_idx
  on public.videos using gin (lower(title) gin_trgm_ops);

create index if not exists videos_creator_name_trgm_idx
  on public.videos using gin (lower(creator_name) gin_trgm_ops);

create index if not exists videos_creator_handle_trgm_idx
  on public.videos using gin (lower(creator_handle) gin_trgm_ops);

create index if not exists video_tags_video_id_idx
  on public.video_tags (video_id);

create index if not exists video_analysis_video_id_idx
  on public.video_analysis (video_id);

create index if not exists collections_user_type_idx
  on public.collections (user_id, type);

create index if not exists collection_videos_collection_id_idx
  on public.collection_videos (collection_id);

create index if not exists collection_videos_video_id_idx
  on public.collection_videos (video_id);

create index if not exists processing_jobs_video_status_idx
  on public.processing_jobs (video_id, status);

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists set_videos_updated_at on public.videos;
create trigger set_videos_updated_at
before update on public.videos
for each row execute function public.touch_updated_at();

drop trigger if exists set_collections_updated_at on public.collections;
create trigger set_collections_updated_at
before update on public.collections
for each row execute function public.touch_updated_at();

drop trigger if exists set_processing_jobs_updated_at on public.processing_jobs;
create trigger set_processing_jobs_updated_at
before update on public.processing_jobs
for each row execute function public.touch_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Collector'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.video_tags enable row level security;
alter table public.video_analysis enable row level security;
alter table public.collections enable row level security;
alter table public.collection_videos enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.usage_events enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() is not null and auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() is not null and auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() is not null and auth.uid() = id)
  with check (auth.uid() is not null and auth.uid() = id);

drop policy if exists "videos_select_own" on public.videos;
create policy "videos_select_own"
  on public.videos
  for select
  using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "videos_insert_own" on public.videos;
create policy "videos_insert_own"
  on public.videos
  for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "videos_update_own" on public.videos;
create policy "videos_update_own"
  on public.videos
  for update
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "videos_delete_own" on public.videos;
create policy "videos_delete_own"
  on public.videos
  for delete
  using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "video_tags_select_own" on public.video_tags;
create policy "video_tags_select_own"
  on public.video_tags
  for select
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.videos v
      where v.id = video_id
        and v.user_id = auth.uid()
    )
  );

drop policy if exists "video_tags_insert_own" on public.video_tags;
create policy "video_tags_insert_own"
  on public.video_tags
  for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1
      from public.videos v
      where v.id = video_id
        and v.user_id = auth.uid()
    )
  );

drop policy if exists "video_tags_update_own" on public.video_tags;
create policy "video_tags_update_own"
  on public.video_tags
  for update
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.videos v
      where v.id = video_id
        and v.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() is not null
    and exists (
      select 1
      from public.videos v
      where v.id = video_id
        and v.user_id = auth.uid()
    )
  );

drop policy if exists "video_tags_delete_own" on public.video_tags;
create policy "video_tags_delete_own"
  on public.video_tags
  for delete
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.videos v
      where v.id = video_id
        and v.user_id = auth.uid()
    )
  );

drop policy if exists "video_analysis_select_own" on public.video_analysis;
create policy "video_analysis_select_own"
  on public.video_analysis
  for select
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.videos v
      where v.id = video_id
        and v.user_id = auth.uid()
    )
  );

drop policy if exists "collections_select_own" on public.collections;
create policy "collections_select_own"
  on public.collections
  for select
  using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "collections_insert_own" on public.collections;
create policy "collections_insert_own"
  on public.collections
  for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "collections_update_own" on public.collections;
create policy "collections_update_own"
  on public.collections
  for update
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_delete_own"
  on public.collections
  for delete
  using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "collection_videos_select_own" on public.collection_videos;
create policy "collection_videos_select_own"
  on public.collection_videos
  for select
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.collections c
      where c.id = collection_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.videos v
      where v.id = video_id
        and v.user_id = auth.uid()
    )
  );

drop policy if exists "collection_videos_insert_own" on public.collection_videos;
create policy "collection_videos_insert_own"
  on public.collection_videos
  for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1
      from public.collections c
      where c.id = collection_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.videos v
      where v.id = video_id
        and v.user_id = auth.uid()
    )
  );

drop policy if exists "collection_videos_delete_own" on public.collection_videos;
create policy "collection_videos_delete_own"
  on public.collection_videos
  for delete
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.collections c
      where c.id = collection_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "processing_jobs_select_own" on public.processing_jobs;
create policy "processing_jobs_select_own"
  on public.processing_jobs
  for select
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.videos v
      where v.id = video_id
        and v.user_id = auth.uid()
    )
  );

drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own"
  on public.usage_events
  for select
  using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  using (auth.uid() is not null and auth.uid() = user_id);

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on public.profiles to authenticated, service_role;
grant select, insert, update, delete on public.videos to authenticated, service_role;
grant select, insert, update, delete on public.video_tags to authenticated, service_role;
grant select on public.video_analysis to authenticated;
grant select, insert, update, delete on public.video_analysis to service_role;
grant select, insert, update, delete on public.collections to authenticated, service_role;
grant select, insert, update, delete on public.collection_videos to authenticated, service_role;
grant select on public.processing_jobs to authenticated;
grant select, insert, update, delete on public.processing_jobs to service_role;
grant select on public.usage_events to authenticated;
grant select, insert, update, delete on public.usage_events to service_role;
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscriptions to service_role;
