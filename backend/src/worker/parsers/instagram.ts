import type { ParsedVideoMetadata } from "./types.js";
import { env } from "../../config/env.js";

type InstagramOEmbedResponse = {
  title?: string | null;
  author_name?: string | null;
  thumbnail_url?: string | null;
  html?: string | null;
};

let cachedAppToken: Promise<string | null> | null = null;

export function extractInstagramShortcode(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^m\./, "").replace(/^www\./, "");
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (!(host === "instagram.com" || host.endsWith(".instagram.com"))) {
      return null;
    }

    const reelIndex = segments.indexOf("reel");
    if (reelIndex >= 0) {
      return segments[reelIndex + 1] ?? null;
    }

    const postIndex = segments.indexOf("p");
    if (postIndex >= 0) {
      return segments[postIndex + 1] ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

async function requestAppToken(): Promise<string | null> {
  const appId = env.INSTAGRAM_APP_ID?.trim();
  const appSecret = env.INSTAGRAM_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    console.warn("INSTAGRAM_APP_ID and/or INSTAGRAM_APP_SECRET are not set");
    return null;
  }

  const endpoint = new URL("https://graph.facebook.com/oauth/access_token");
  endpoint.searchParams.set("client_id", appId);
  endpoint.searchParams.set("client_secret", appSecret);
  endpoint.searchParams.set("grant_type", "client_credentials");

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch (error) {
    console.warn(
      `Failed to fetch Instagram app token: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }

  if (!response.ok) {
    console.warn(`Failed to fetch Instagram app token with status ${response.status}`);
    return null;
  }

  try {
    const payload = (await response.json()) as { access_token?: string | null };
    return payload.access_token?.trim() || null;
  } catch (error) {
    console.warn(
      `Failed to parse Instagram app token response: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

cachedAppToken = requestAppToken();

export function getAppToken(): Promise<string | null> {
  return cachedAppToken ?? requestAppToken();
}

async function fetchInstagramOEmbed(originalUrl: string, appToken: string): Promise<InstagramOEmbedResponse | null> {
  const endpoint = new URL("https://graph.facebook.com/v18.0/instagram_oembed");
  endpoint.searchParams.set("url", originalUrl);
  endpoint.searchParams.set("fields", "title,author_name,thumbnail_url,html");
  endpoint.searchParams.set("access_token", appToken);

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch (error) {
    console.warn(
      `Failed to fetch Instagram oEmbed data: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }

  if (!response.ok) {
    if (response.status === 400) {
      return null;
    }

    if (response.status === 401) {
      console.error("Instagram oEmbed request failed with status 401");
      return null;
    }

    console.warn(`Instagram oEmbed request failed with status ${response.status}`);
    return null;
  }

  try {
    return (await response.json()) as InstagramOEmbedResponse;
  } catch (error) {
    console.warn(
      `Failed to parse Instagram oEmbed response: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

export async function parseInstagram(url: string): Promise<ParsedVideoMetadata | null> {
  const shortcode = extractInstagramShortcode(url);
  if (!shortcode) {
    return null;
  }

  const appToken = await getAppToken();
  if (!appToken) {
    return null;
  }

  const response = await fetchInstagramOEmbed(url, appToken);
  if (!response) {
    return null;
  }

  return {
    platformVideoId: shortcode,
    title: response.title ?? null,
    description: null,
    caption: null,
    creatorName: response.author_name ?? null,
    creatorHandle: null,
    thumbnailUrl: response.thumbnail_url ?? null,
    embedUrl: null,
    embedHtml: response.html ?? null,
    durationSeconds: null,
    hashtags: [],
    language: null,
  };
}
