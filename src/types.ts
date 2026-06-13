export type TabKey = 'home' | 'search' | 'collections' | 'profile';

export interface HydratedVideo {
  id: string;
  user_id: string;
  source_url: string;
  normalized_url: string;
  platform: string;
  platform_video_id: string | null;
  content_type: string | null;
  title: string | null;
  description: string | null;
  caption: string | null;
  hashtags: string[];
  creator_name: string | null;
  creator_handle: string | null;
  thumbnail_url: string | null;
  embed_url: string | null;
  embed_html: string | null;
  duration_seconds: number | null;
  language: string | null;
  status: string;
  metadata_status: string;
  analysis_status: string;
  summary: string | null;
  saved_at: string;
  updated_at: string;
  tags: Array<{ tag: string; source: string }>;
  collections: Array<{ id: string; name: string; type: string }>;
  analysis: Record<string, unknown> | null;
}

export interface CollectionItem {
  id: string;
  name: string;
  description: string | null;
  type: string;
  icon: string | null;
  item_count: number;
  rules_json: unknown;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionDetail extends CollectionItem {
  videos: HydratedVideo[];
}
