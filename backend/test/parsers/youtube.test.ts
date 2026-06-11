import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";
process.env.YOUTUBE_API_KEY ??= "test-youtube-key";

const {
  extractYouTubeVideoId,
  parseDuration,
  parseYouTube,
} = await import("../../src/worker/parsers/youtube.js");

function withMockedFetch<T>(mockFetch: typeof fetch, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  return run().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

test("extractYouTubeVideoId extracts ids from watch URLs", () => {
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=VIDEO_ID"), "VIDEO_ID");
});

test("extractYouTubeVideoId extracts ids from youtu.be URLs", () => {
  assert.equal(extractYouTubeVideoId("https://youtu.be/VIDEO_ID"), "VIDEO_ID");
});

test("extractYouTubeVideoId extracts ids from shorts URLs", () => {
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/shorts/VIDEO_ID"), "VIDEO_ID");
});

test("extractYouTubeVideoId passes through raw video ids", () => {
  assert.equal(extractYouTubeVideoId("VIDEO_ID"), "VIDEO_ID");
});

test("parseDuration converts PT4M13S to seconds", () => {
  assert.equal(parseDuration("PT4M13S"), 253);
});

test("parseDuration converts PT1H2M3S to seconds", () => {
  assert.equal(parseDuration("PT1H2M3S"), 3723);
});

test("parseYouTube maps a full mock response correctly", async () => {
  await withMockedFetch(
    async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              id: "VIDEO_ID",
              snippet: {
                title: "Video Title",
                description: "Video Description",
                channelTitle: "Creator Name",
                thumbnails: {
                  high: {
                    url: "https://img.example/high.jpg",
                  },
                },
                tags: ["tag-one", "tag-two"],
                defaultAudioLanguage: "en",
              },
              contentDetails: {
                duration: "PT4M13S",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    async () => {
      const result = await parseYouTube("https://www.youtube.com/watch?v=VIDEO_ID");

      assert.deepEqual(result, {
        platformVideoId: "VIDEO_ID",
        title: "Video Title",
        description: "Video Description",
        caption: null,
        creatorName: "Creator Name",
        creatorHandle: null,
        thumbnailUrl: "https://img.example/high.jpg",
        embedUrl: "https://www.youtube.com/embed/VIDEO_ID",
        embedHtml:
          '<iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID" frameborder="0" allowfullscreen></iframe>',
        durationSeconds: 253,
        hashtags: ["tag-one", "tag-two"],
        language: "en",
      });
    },
  );
});

test("parseYouTube returns null when the API returns an empty items array", async () => {
  await withMockedFetch(
    async () =>
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    async () => {
      const result = await parseYouTube("VIDEO_ID");
      assert.equal(result, null);
    },
  );
});

test("parseYouTube returns null for HTTP 403 without throwing", async () => {
  await withMockedFetch(
    async () => new Response("{}", { status: 403 }),
    async () => {
      const result = await parseYouTube("VIDEO_ID");
      assert.equal(result, null);
    },
  );
});

test("parseYouTube falls back to the medium thumbnail", async () => {
  await withMockedFetch(
    async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: {
                title: "Video Title",
                description: "Video Description",
                channelTitle: "Creator Name",
                thumbnails: {
                  medium: {
                    url: "https://img.example/medium.jpg",
                  },
                },
                tags: [],
              },
              contentDetails: {
                duration: "PT30S",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    async () => {
      const result = await parseYouTube("VIDEO_ID");
      assert.equal(result?.thumbnailUrl, "https://img.example/medium.jpg");
    },
  );
});

test("parseYouTube returns an empty array for missing tags", async () => {
  await withMockedFetch(
    async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: {
                title: "Video Title",
                description: "Video Description",
                channelTitle: "Creator Name",
                thumbnails: {
                  high: {
                    url: "https://img.example/high.jpg",
                  },
                },
                defaultLanguage: "en",
              },
              contentDetails: {
                duration: "PT30S",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    async () => {
      const result = await parseYouTube("VIDEO_ID");
      assert.deepEqual(result?.hashtags, []);
    },
  );
});
