import { AppError } from "./errors.js";

export type SupportedPlatform = "tiktok" | "instagram" | "youtube" | "twitter";

export interface NormalizedVideoUrl {
  canonical: string;
  platform: SupportedPlatform;
  platformVideoId: string;
}

function stripTrackingParams(url: URL): void {
  const paramsToRemove = Array.from(url.searchParams.keys()).filter((key) =>
    key.startsWith("utm_") || key === "fbclid" || key === "igshid" || key === "si",
  );

  for (const key of paramsToRemove) {
    url.searchParams.delete(key);
  }
}

function requireHttps(url: URL): void {
  if (url.protocol !== "https:") {
    throw new AppError(400, "invalid_url", "Only HTTPS URLs are supported");
  }
}

function canonicalizeYoutube(url: URL): NormalizedVideoUrl {
  const host = url.hostname.replace(/^m\./, "").replace(/^www\./, "");
  const segments = url.pathname.split("/").filter(Boolean);
  let videoId = "";
  let canonicalPath: "watch" | "shorts" = "watch";

  if (host === "youtu.be") {
    videoId = segments[0] ?? "";
  } else if (url.pathname.startsWith("/shorts/")) {
    videoId = segments[1] ?? "";
    canonicalPath = "shorts";
  } else if (url.pathname === "/watch" || url.pathname === "/watch/") {
    videoId = url.searchParams.get("v") ?? "";
  } else if (url.pathname.startsWith("/live/")) {
    videoId = segments[1] ?? "";
  } else if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/v/")) {
    videoId = segments[1] ?? "";
  }

  if (!videoId) {
    throw new AppError(400, "unsupported_url", "Unsupported YouTube URL format");
  }

  const canonical = canonicalPath === "shorts"
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
  return {
    canonical,
    platform: "youtube",
    platformVideoId: videoId,
  };
}

function canonicalizeInstagram(url: URL): NormalizedVideoUrl {
  const segments = url.pathname.split("/").filter(Boolean);
  const reelIndex = segments.indexOf("reel");
  const pIndex = segments.indexOf("p");
  const videoId = reelIndex >= 0 ? segments[reelIndex + 1] : pIndex >= 0 ? segments[pIndex + 1] : "";

  if (!videoId) {
    throw new AppError(400, "unsupported_url", "Unsupported Instagram URL format");
  }

  const canonical = `https://www.instagram.com/reel/${videoId}/`;
  return {
    canonical,
    platform: "instagram",
    platformVideoId: videoId,
  };
}

function canonicalizeTiktok(url: URL): NormalizedVideoUrl {
  const segments = url.pathname.split("/").filter(Boolean);
  const videoIndex = segments.indexOf("video");
  const videoId = videoIndex >= 0 ? segments[videoIndex + 1] ?? "" : "";

  if (!videoId) {
    throw new AppError(400, "unsupported_url", "Unsupported TikTok URL format");
  }

  const creatorSegment = segments.find((segment) => segment.startsWith("@")) ?? "@unknown";
  const canonical = `https://www.tiktok.com/${creatorSegment}/video/${videoId}`;
  return {
    canonical,
    platform: "tiktok",
    platformVideoId: videoId,
  };
}

function canonicalizeTwitter(url: URL): NormalizedVideoUrl {
  const segments = url.pathname.split("/").filter(Boolean);
  const statusIndex = segments.indexOf("status");
  const videoId = statusIndex >= 0 ? segments[statusIndex + 1] ?? "" : "";

  if (!videoId) {
    throw new AppError(400, "unsupported_url", "Unsupported Twitter/X URL format");
  }

  const handle = segments[0] && segments[0] !== "i" ? segments[0] : "i";
  const canonical = `https://x.com/${handle}/status/${videoId}`;
  return {
    canonical,
    platform: "twitter",
    platformVideoId: videoId,
  };
}

export function normalizeVideoUrl(rawUrl: string): NormalizedVideoUrl {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError(400, "invalid_url", "Invalid URL");
  }

  requireHttps(url);
  stripTrackingParams(url);

  const host = url.hostname.replace(/^m\./, "").replace(/^www\./, "");

  if (host.endsWith("youtube.com") || host === "youtu.be") {
    return canonicalizeYoutube(url);
  }

  if (host.endsWith("instagram.com")) {
    return canonicalizeInstagram(url);
  }

  if (host.endsWith("tiktok.com")) {
    return canonicalizeTiktok(url);
  }

  if (host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com") {
    throw new AppError(400, "platform_unsupported", "X (Twitter) isn't supported yet");
  }

  throw new AppError(400, "unsupported_platform", "Unsupported platform URL");
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export function buildSearchText(parts: Array<string | null | undefined>): string {
  return parts
    .flatMap((part) => (typeof part === "string" ? [part] : []))
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}
