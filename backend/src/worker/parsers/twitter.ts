import type { ParsedVideoMetadata } from "./types.js";

type TwitterOEmbedResponse = {
  author_name?: string | null;
  author_url?: string | null;
  html?: string | null;
};

type TwitterApiV2Response = {
  data?: {
    text?: string | null;
    entities?: {
      hashtags?: Array<{ tag?: string | null }>;
    } | null;
    lang?: string | null;
  } | null;
  includes?: {
    media?: Array<{
      preview_image_url?: string | null;
      duration_ms?: number | null;
    }>;
    users?: Array<{
      name?: string | null;
      username?: string | null;
    }>;
  } | null;
};

export function extractTweetId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^m\./, "").replace(/^www\./, "");
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (!(host === "twitter.com" || host === "x.com" || host === "mobile.twitter.com")) {
      return null;
    }

    const statusIndex = segments.indexOf("status");
    if (statusIndex < 0) {
      return null;
    }

    return segments[statusIndex + 1] ?? null;
  } catch {
    return null;
  }
}

function extractHandle(authorUrl?: string | null): string | null {
  if (!authorUrl) {
    return null;
  }

  try {
    const parsed = new URL(authorUrl);
    const username = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    return username ? `@${username}` : null;
  } catch {
    return null;
  }
}

async function fetchOEmbed(originalUrl: string): Promise<TwitterOEmbedResponse | null> {
  const endpoint = new URL("https://publish.twitter.com/oembed");
  endpoint.searchParams.set("url", originalUrl);
  endpoint.searchParams.set("omit_script", "true");

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch (error) {
    console.warn(
      `Failed to fetch Twitter oEmbed data: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }

  if (!response.ok) {
    console.warn(`Twitter oEmbed request failed with status ${response.status}`);
    return null;
  }

  try {
    return (await response.json()) as TwitterOEmbedResponse;
  } catch (error) {
    console.warn(
      `Failed to parse Twitter oEmbed response: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function fetchApiV2(tweetId: string): Promise<TwitterApiV2Response | null> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN?.trim();
  if (!bearerToken) {
    return null;
  }

  const endpoint = new URL(`https://api.twitter.com/2/tweets/${tweetId}`);
  endpoint.searchParams.set("tweet.fields", "text,entities,lang");
  endpoint.searchParams.set("expansions", "author_id,attachments.media_keys");
  endpoint.searchParams.set("media.fields", "preview_image_url,duration_ms");
  endpoint.searchParams.set("user.fields", "name,username");

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    });
  } catch (error) {
    console.warn(
      `Failed to fetch Twitter API v2 data: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }

  if (!response.ok) {
    if (response.status === 429) {
      console.warn(`Twitter API v2 rate limited with status 429 for tweet ${tweetId}`);
    } else {
      console.warn(`Twitter API v2 request failed with status ${response.status} for tweet ${tweetId}`);
    }
    return null;
  }

  try {
    return (await response.json()) as TwitterApiV2Response;
  } catch (error) {
    console.warn(
      `Failed to parse Twitter API v2 response: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

export async function parseTwitter(url: string): Promise<ParsedVideoMetadata | null> {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    return null;
  }

  const oembed = await fetchOEmbed(url);
  if (!oembed) {
    return null;
  }

  let api: TwitterApiV2Response | null = null;
  if (process.env.TWITTER_BEARER_TOKEN?.trim()) {
    api = await fetchApiV2(tweetId);
  }

  const apiData = api?.data ?? null;
  const apiMedia = api?.includes?.media?.[0] ?? null;
  const apiUser = api?.includes?.users?.[0] ?? null;

  const apiHashtags = apiData?.entities?.hashtags?.map((hashtag) => hashtag.tag).filter(
    (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
  ) ?? [];

  return {
    platformVideoId: tweetId,
    title: null,
    description: apiData?.text ?? null,
    caption: null,
    creatorName: apiUser?.name ?? oembed.author_name ?? null,
    creatorHandle: extractHandle(apiUser?.username ? `https://twitter.com/${apiUser.username}` : null) ?? extractHandle(oembed.author_url) ?? null,
    thumbnailUrl: apiMedia?.preview_image_url ?? null,
    embedUrl: null,
    embedHtml: oembed.html ?? null,
    durationSeconds: typeof apiMedia?.duration_ms === "number" ? Math.round(apiMedia.duration_ms / 1000) : null,
    hashtags: apiHashtags,
    language: apiData?.lang ?? null,
  };
}
