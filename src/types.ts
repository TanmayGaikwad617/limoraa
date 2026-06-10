export type PlatformKey = 'YouTube' | 'Instagram' | 'TikTok';
export type VideoStatus = 'Ready' | 'Analyzing' | 'Queued' | 'Failed';
export type ContentType = 'Recipe' | 'Workout' | 'DIY' | 'Education';
export type TabKey = 'home' | 'search' | 'collections' | 'detail' | 'profile';

export type VideoItem = {
  id: string;
  title: string;
  creator: string;
  platform: PlatformKey;
  type: ContentType;
  status: VideoStatus;
  summary: string;
  tags: string[];
  collection: string;
  savedAgo: string;
  thumbnailColor: string;
  sourceUrl: string;
  embedUrl?: string;
};

export type CollectionItem = {
  id: string;
  name: string;
  kind: 'Manual' | 'Smart';
  note: string;
  itemCount: number;
  cover: string[];
};
