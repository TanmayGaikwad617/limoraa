import { env } from "../../config/env.js";
export function extractYouTubeVideoId(input) {
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }
    try {
        const url = new URL(trimmed);
        const host = url.hostname.replace(/^m\./, "").replace(/^www\./, "");
        if (host === "youtu.be") {
            const videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
            return videoId || null;
        }
        if (host.endsWith("youtube.com")) {
            if (url.pathname.startsWith("/watch")) {
                const videoId = url.searchParams.get("v");
                return videoId?.trim() || null;
            }
            if (url.pathname.startsWith("/shorts/")) {
                const videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
                return videoId || null;
            }
            if (url.pathname.startsWith("/live/")) {
                const videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
                return videoId || null;
            }
            if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/v/")) {
                const videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
                return videoId || null;
            }
        }
        return null;
    }
    catch {
        return trimmed;
    }
}
export function parseDuration(iso) {
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso.trim());
    if (!match) {
        return null;
    }
    const hours = Number.parseInt(match[1] ?? "0", 10);
    const minutes = Number.parseInt(match[2] ?? "0", 10);
    const seconds = Number.parseInt(match[3] ?? "0", 10);
    return hours * 3600 + minutes * 60 + seconds;
}
function getThumbnailUrl(snippet) {
    return snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? null;
}
export async function parseYouTube(urlOrId) {
    const videoId = extractYouTubeVideoId(urlOrId);
    if (!videoId) {
        return null;
    }
    const apiKey = env.YOUTUBE_API_KEY?.trim();
    if (!apiKey) {
        console.warn("YOUTUBE_API_KEY is not set");
        return null;
    }
    const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
    endpoint.searchParams.set("part", "snippet,contentDetails");
    endpoint.searchParams.set("id", videoId);
    endpoint.searchParams.set("key", apiKey);
    let response;
    try {
        response = await fetch(endpoint);
    }
    catch (error) {
        console.warn(`Failed to fetch YouTube video metadata for ${videoId}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
    if (!response.ok) {
        if (response.status === 403) {
            console.error(`YouTube API request failed with status 403 for video ${videoId}`);
            return null;
        }
        if (response.status >= 500) {
            console.error(`YouTube API request failed with status ${response.status} for video ${videoId}`);
            return null;
        }
        if (response.status >= 400) {
            console.warn(`YouTube API request failed with status ${response.status} for video ${videoId}`);
            return null;
        }
    }
    let payload;
    try {
        payload = (await response.json());
    }
    catch (error) {
        console.warn(`Failed to parse YouTube API response for ${videoId}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
    const item = payload.items?.[0];
    if (!item) {
        return null;
    }
    const snippet = item.snippet ?? null;
    const contentDetails = item.contentDetails ?? null;
    return {
        platformVideoId: videoId,
        title: snippet?.title ?? null,
        description: snippet?.description ?? null,
        caption: null,
        creatorName: snippet?.channelTitle ?? null,
        creatorHandle: null,
        thumbnailUrl: snippet ? getThumbnailUrl(snippet) : null,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        embedHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`,
        durationSeconds: contentDetails?.duration ? parseDuration(contentDetails.duration) : null,
        hashtags: Array.isArray(snippet?.tags) ? snippet.tags : [],
        language: snippet?.defaultAudioLanguage ?? snippet?.defaultLanguage ?? null,
    };
}
