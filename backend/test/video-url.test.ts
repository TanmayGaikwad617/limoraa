import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

const { normalizeVideoUrl } = await import("../src/lib/video.js");

test("normalizes YouTube watch URLs to long form", () => {
  assert.deepEqual(normalizeVideoUrl("https://www.youtube.com/watch?v=VIDEO_ID&si=abc"), {
    canonical: "https://www.youtube.com/watch?v=VIDEO_ID",
    platform: "youtube",
    platformVideoId: "VIDEO_ID",
  });
});

test("normalizes youtu.be URLs to long form", () => {
  assert.deepEqual(normalizeVideoUrl("https://youtu.be/VIDEO_ID?si=abc"), {
    canonical: "https://www.youtube.com/watch?v=VIDEO_ID",
    platform: "youtube",
    platformVideoId: "VIDEO_ID",
  });
});

test("normalizes YouTube Shorts URLs to shorts form", () => {
  assert.deepEqual(normalizeVideoUrl("https://www.youtube.com/shorts/VIDEO_ID"), {
    canonical: "https://www.youtube.com/shorts/VIDEO_ID",
    platform: "youtube",
    platformVideoId: "VIDEO_ID",
  });
});

test("normalizes YouTube live URLs to long form", () => {
  assert.deepEqual(normalizeVideoUrl("https://www.youtube.com/live/VIDEO_ID"), {
    canonical: "https://www.youtube.com/watch?v=VIDEO_ID",
    platform: "youtube",
    platformVideoId: "VIDEO_ID",
  });
});

test("normalizes YouTube embed URLs to long form", () => {
  assert.deepEqual(normalizeVideoUrl("https://www.youtube.com/embed/VIDEO_ID"), {
    canonical: "https://www.youtube.com/watch?v=VIDEO_ID",
    platform: "youtube",
    platformVideoId: "VIDEO_ID",
  });
});

test("blocks twitter.com status URLs at save time", () => {
  assert.throws(
    () => normalizeVideoUrl("https://twitter.com/user/status/1234567890?s=20"),
    /X \(Twitter\) isn't supported yet/,
  );
});

test("blocks x.com status URLs at save time", () => {
  assert.throws(
    () => normalizeVideoUrl("https://x.com/user/status/987654321"),
    /X \(Twitter\) isn't supported yet/,
  );
});
