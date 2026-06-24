import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

function withMockedFetch<T>(mockFetch: typeof fetch, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  return run().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

async function loadParser(mockFetch: typeof fetch) {
  return withMockedFetch(mockFetch, async () => {
    const url = new URL("../../src/worker/parsers/twitter.js", import.meta.url);
    url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
    return import(url.href);
  });
}

function twitterMockFetch(
  oembedBody: unknown,
  apiBody?: unknown,
  apiStatus = 200,
  bearerToken?: string,
) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.hostname === "publish.twitter.com" && url.pathname === "/oembed") {
      return new Response(JSON.stringify(oembedBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.hostname === "api.twitter.com" && url.pathname.startsWith("/2/tweets/")) {
      if (!bearerToken) {
        throw new Error("API v2 should not be called without a bearer token");
      }

      if (init?.headers && "Authorization" in init.headers) {
        // no-op, we just assert the request can be made with auth
      }

      return new Response(JSON.stringify(apiBody ?? {}), {
        status: apiStatus,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("{}", { status: 404 });
  };
}

test("twitter.com URL extracts correct tweet ID", async () => {
  const { extractTweetId } = await loadParser(twitterMockFetch({}));
  assert.equal(extractTweetId("https://twitter.com/user/status/1234567890"), "1234567890");
});

test("x.com URL extracts correct tweet ID", async () => {
  const { extractTweetId } = await loadParser(twitterMockFetch({}));
  assert.equal(extractTweetId("https://x.com/user/status/1234567890"), "1234567890");
});

test("mobile.twitter.com URL extracts correct tweet ID", async () => {
  const { extractTweetId } = await loadParser(twitterMockFetch({}));
  assert.equal(extractTweetId("https://mobile.twitter.com/user/status/1234567890"), "1234567890");
});

test("author_url correctly produces @username handle", async () => {
  process.env.TWITTER_BEARER_TOKEN = "";
  const { parseTwitter } = await loadParser(
    twitterMockFetch({
      author_name: "OEmbed Creator",
      author_url: "https://twitter.com/username",
      html: "<blockquote>tweet</blockquote>",
    }),
  );

  const result = await withMockedFetch(
    twitterMockFetch({
      author_name: "OEmbed Creator",
      author_url: "https://twitter.com/username",
      html: "<blockquote>tweet</blockquote>",
    }),
    async () => parseTwitter("https://twitter.com/user/status/1234567890"),
  );

  assert.equal(result?.creatorHandle, "@username");
});

test("oEmbed-only result returned when bearer token absent", async () => {
  delete process.env.TWITTER_BEARER_TOKEN;
  const { parseTwitter } = await loadParser(
    twitterMockFetch({
      author_name: "OEmbed Creator",
      author_url: "https://twitter.com/username",
      html: "<blockquote>tweet</blockquote>",
    }),
  );

  const result = await withMockedFetch(
    twitterMockFetch({
      author_name: "OEmbed Creator",
      author_url: "https://twitter.com/username",
      html: "<blockquote>tweet</blockquote>",
    }),
    async () => parseTwitter("https://twitter.com/user/status/1234567890"),
  );

  assert.deepEqual(result, {
    platformVideoId: "1234567890",
    title: null,
    description: null,
    caption: null,
    creatorName: "OEmbed Creator",
    creatorHandle: "@username",
    thumbnailUrl: null,
    embedUrl: null,
    embedHtml: "<blockquote>tweet</blockquote>",
    durationSeconds: null,
    hashtags: [],
    language: null,
  });
});

test("API v2 values override oEmbed values when both present", async () => {
  process.env.TWITTER_BEARER_TOKEN = "bearer-token";
  const { parseTwitter } = await loadParser(
    twitterMockFetch(
      {
        author_name: "OEmbed Creator",
        author_url: "https://twitter.com/oembed",
        html: "<blockquote>tweet</blockquote>",
      },
      {
        data: {
          text: "API description",
          entities: {
            hashtags: [{ tag: "One" }, { tag: "Two" }],
          },
          lang: "en",
        },
        includes: {
          media: [
            {
              preview_image_url: "https://img.example/preview.jpg",
              duration_ms: 4200,
            },
          ],
          users: [
            {
              name: "API Creator",
              username: "apiuser",
            },
          ],
        },
      },
      200,
      "bearer-token",
    ),
  );

  const result = await withMockedFetch(
    twitterMockFetch(
      {
        author_name: "OEmbed Creator",
        author_url: "https://twitter.com/oembed",
        html: "<blockquote>tweet</blockquote>",
      },
      {
        data: {
          text: "API description",
          entities: {
            hashtags: [{ tag: "One" }, { tag: "Two" }],
          },
          lang: "en",
        },
        includes: {
          media: [
            {
              preview_image_url: "https://img.example/preview.jpg",
              duration_ms: 4200,
            },
          ],
          users: [
            {
              name: "API Creator",
              username: "apiuser",
            },
          ],
        },
      },
      200,
      "bearer-token",
    ),
    async () => parseTwitter("https://twitter.com/user/status/1234567890"),
  );

  assert.deepEqual(result, {
    platformVideoId: "1234567890",
    title: null,
    description: "API description",
    caption: null,
    creatorName: "API Creator",
    creatorHandle: "@apiuser",
    thumbnailUrl: "https://img.example/preview.jpg",
    embedUrl: null,
    embedHtml: "<blockquote>tweet</blockquote>",
    durationSeconds: 4,
    hashtags: ["One", "Two"],
    language: "en",
  });
});

test("API v2 failure returns oEmbed result, not null", async () => {
  process.env.TWITTER_BEARER_TOKEN = "bearer-token";
  const { parseTwitter } = await loadParser(
    twitterMockFetch(
      {
        author_name: "OEmbed Creator",
        author_url: "https://twitter.com/username",
        html: "<blockquote>tweet</blockquote>",
      },
      {},
      500,
      "bearer-token",
    ),
  );

  const result = await withMockedFetch(
    twitterMockFetch(
      {
        author_name: "OEmbed Creator",
        author_url: "https://twitter.com/username",
        html: "<blockquote>tweet</blockquote>",
      },
      {},
      500,
      "bearer-token",
    ),
    async () => parseTwitter("https://twitter.com/user/status/1234567890"),
  );

  assert.equal(result?.creatorName, "OEmbed Creator");
  assert.equal(result?.creatorHandle, "@username");
  assert.equal(result?.embedHtml, "<blockquote>tweet</blockquote>");
});

test("HTTP 429 on API v2 returns oEmbed result without throwing", async () => {
  process.env.TWITTER_BEARER_TOKEN = "bearer-token";
  const { parseTwitter } = await loadParser(
    twitterMockFetch(
      {
        author_name: "OEmbed Creator",
        author_url: "https://twitter.com/username",
        html: "<blockquote>tweet</blockquote>",
      },
      {},
      429,
      "bearer-token",
    ),
  );

  const result = await withMockedFetch(
    twitterMockFetch(
      {
        author_name: "OEmbed Creator",
        author_url: "https://twitter.com/username",
        html: "<blockquote>tweet</blockquote>",
      },
      {},
      429,
      "bearer-token",
    ),
    async () => parseTwitter("https://twitter.com/user/status/1234567890"),
  );

  assert.equal(result?.creatorName, "OEmbed Creator");
  assert.equal(result?.embedHtml, "<blockquote>tweet</blockquote>");
});

test("HTTP 402 on API v2 falls back to oEmbed and skips later API v2 calls", async () => {
  process.env.TWITTER_BEARER_TOKEN = "bearer-token";
  let apiCalls = 0;
  const mockFetch = async (input: string | URL | Request) => {
    const url = new URL(String(input));

    if (url.hostname === "publish.twitter.com" && url.pathname === "/oembed") {
      return new Response(JSON.stringify({
        author_name: "OEmbed Creator",
        author_url: "https://twitter.com/username",
        html: "<blockquote>tweet</blockquote>",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.hostname === "api.twitter.com" && url.pathname.startsWith("/2/tweets/")) {
      apiCalls += 1;
      return new Response("{}", { status: 402 });
    }

    return new Response("{}", { status: 404 });
  };

  const { parseTwitter } = await loadParser(mockFetch);

  const [firstResult, secondResult] = await withMockedFetch(mockFetch, async () => [
    await parseTwitter("https://twitter.com/user/status/1234567890"),
    await parseTwitter("https://twitter.com/user/status/1234567891"),
  ]);

  assert.equal(firstResult?.creatorName, "OEmbed Creator");
  assert.equal(secondResult?.creatorName, "OEmbed Creator");
  assert.equal(apiCalls, 1);
});

test("oEmbed failure returns null", async () => {
  process.env.TWITTER_BEARER_TOKEN = "bearer-token";
  const { parseTwitter } = await loadParser(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.hostname === "publish.twitter.com" && url.pathname === "/oembed") {
      return new Response("{}", { status: 500 });
    }

    throw new Error("API v2 should not be called when oEmbed fails");
  });

  const result = await withMockedFetch(
    async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.hostname === "publish.twitter.com" && url.pathname === "/oembed") {
        return new Response("{}", { status: 500 });
      }

      throw new Error("API v2 should not be called when oEmbed fails");
    },
    async () => parseTwitter("https://twitter.com/user/status/1234567890"),
  );

  assert.equal(result, null);
});
