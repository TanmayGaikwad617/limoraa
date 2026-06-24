import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";
process.env.INSTAGRAM_APP_ID ??= "app-id";
process.env.INSTAGRAM_APP_SECRET ??= "app-secret";

function withMockedFetch<T>(mockFetch: typeof fetch, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  return run().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

async function loadParser(mockFetch: typeof fetch) {
  return withMockedFetch(mockFetch, async () => {
    const url = new URL("../../src/worker/parsers/instagram.js", import.meta.url);
    url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
    return import(url.href);
  });
}

function mockInstagramFetch(responseBody: unknown, status = 200) {
  return async (input: string | URL | Request) => {
    const url = new URL(String(input));

    assert.equal(url.searchParams.get("access_token"), "app-id|app-secret");

    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
}

test("extractInstagramShortcode extracts reel shortcode", async () => {
  const { extractInstagramShortcode } = await loadParser(mockInstagramFetch({}));
  assert.equal(extractInstagramShortcode("https://www.instagram.com/reel/SHORTCODE/"), "SHORTCODE");
});

test("extractInstagramShortcode extracts p shortcode", async () => {
  const { extractInstagramShortcode } = await loadParser(mockInstagramFetch({}));
  assert.equal(extractInstagramShortcode("https://www.instagram.com/p/SHORTCODE/"), "SHORTCODE");
});

test("importing parser does not request an app token", async () => {
  let fetchCalls = 0;

  await loadParser(async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called on import");
  });

  assert.equal(fetchCalls, 0);
});

test("parseInstagram maps a full mock response correctly", async () => {
  const parser = await loadParser(
    mockInstagramFetch({
      title: "Instagram Title",
      author_name: "Instagram Creator",
      thumbnail_url: "https://img.example/thumb.jpg",
      html: "<iframe src='https://instagram.com/embed'></iframe>",
    }),
  );

  const result = await withMockedFetch(
    mockInstagramFetch({
      title: "Instagram Title",
      author_name: "Instagram Creator",
      thumbnail_url: "https://img.example/thumb.jpg",
      html: "<iframe src='https://instagram.com/embed'></iframe>",
    }),
    async () => parser.parseInstagram("https://www.instagram.com/reel/SHORTCODE/"),
  );

  assert.deepEqual(result, {
    platformVideoId: "SHORTCODE",
    title: "Instagram Title",
    description: null,
    caption: null,
    creatorName: "Instagram Creator",
    creatorHandle: null,
    thumbnailUrl: "https://img.example/thumb.jpg",
    embedUrl: null,
    embedHtml: "<iframe src='https://instagram.com/embed'></iframe>",
    durationSeconds: null,
    hashtags: [],
    language: null,
  });
});

test("parseInstagram returns null for HTTP 400 without throwing", async () => {
  const parser = await loadParser(mockInstagramFetch({}, 400));

  const result = await withMockedFetch(
    mockInstagramFetch({}, 400),
    async () => parser.parseInstagram("https://www.instagram.com/reel/SHORTCODE/"),
  );

  assert.equal(result, null);
});

test("parseInstagram returns null for HTTP 401 without throwing", async () => {
  const parser = await loadParser(mockInstagramFetch({}, 401));

  const result = await withMockedFetch(
    mockInstagramFetch({}, 401),
    async () => parser.parseInstagram("https://www.instagram.com/reel/SHORTCODE/"),
  );

  assert.equal(result, null);
});

test("parseInstagram returns null when credentials are missing", async () => {
  const originalId = process.env.INSTAGRAM_APP_ID;
  const originalSecret = process.env.INSTAGRAM_APP_SECRET;
  delete process.env.INSTAGRAM_APP_ID;
  delete process.env.INSTAGRAM_APP_SECRET;

  const parser = await loadParser(async () => {
    throw new Error("fetch should not be called when credentials are missing");
  });

  const result = await parser.parseInstagram("https://www.instagram.com/reel/SHORTCODE/");
  assert.equal(result, null);

  process.env.INSTAGRAM_APP_ID = originalId;
  process.env.INSTAGRAM_APP_SECRET = originalSecret;
});

test("parseInstagram safely handles missing title", async () => {
  const parser = await loadParser(
    mockInstagramFetch({
      author_name: "Instagram Creator",
      thumbnail_url: "https://img.example/thumb.jpg",
      html: "<iframe src='https://instagram.com/embed'></iframe>",
    }),
  );

  const result = await withMockedFetch(
    mockInstagramFetch({
      author_name: "Instagram Creator",
      thumbnail_url: "https://img.example/thumb.jpg",
      html: "<iframe src='https://instagram.com/embed'></iframe>",
    }),
    async () => parser.parseInstagram("https://www.instagram.com/reel/SHORTCODE/"),
  );

  assert.equal(result?.title, null);
});

test("parseInstagram safely handles missing thumbnail", async () => {
  const parser = await loadParser(
    mockInstagramFetch({
      title: "Instagram Title",
      author_name: "Instagram Creator",
      html: "<iframe src='https://instagram.com/embed'></iframe>",
    }),
  );

  const result = await withMockedFetch(
    mockInstagramFetch({
      title: "Instagram Title",
      author_name: "Instagram Creator",
      html: "<iframe src='https://instagram.com/embed'></iframe>",
    }),
    async () => parser.parseInstagram("https://www.instagram.com/reel/SHORTCODE/"),
  );

  assert.equal(result?.thumbnailUrl, null);
});
