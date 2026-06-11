export interface ParsedVideoMetadata {
  platformVideoId: string;
  title: string | null;
  description: string | null;
  caption: string | null;
  creatorName: string | null;
  creatorHandle: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  embedHtml: string | null;
  durationSeconds: number | null;
  hashtags: string[];
  language: string | null;
}
