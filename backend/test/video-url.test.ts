import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

const { normalizeVideoUrl } = await import("../src/lib/video.js");

test("normalizes twitter.com status URLs", () => {
  assert.deepEqual(normalizeVideoUrl("https://twitter.com/user/status/1234567890?s=20"), {
    canonical: "https://x.com/user/status/1234567890",
    platform: "twitter",
    platformVideoId: "1234567890",
  });
});

test("normalizes x.com status URLs", () => {
  assert.deepEqual(normalizeVideoUrl("https://x.com/user/status/987654321"), {
    canonical: "https://x.com/user/status/987654321",
    platform: "twitter",
    platformVideoId: "987654321",
  });
});
