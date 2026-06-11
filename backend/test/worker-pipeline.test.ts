import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

const { buildIndexedSearchText, processIndexVideo } = await import("../src/worker/handlers/indexVideo.js");
const {
  evaluateSmartCollectionRule,
  evaluateSmartCollectionRules,
  processRefreshSmartCollections,
} = await import("../src/worker/handlers/refreshSmartCollections.js");

const baseVideo = {
  id: "video_1",
  user_id: "user_1",
  platform: "youtube",
  creator_name: "YouTube Creator",
  tags: [{ tag: "ai", source: "ai" }],
  analysis: {
    topic: "Technology",
    vertical_fields_json: {
      category: "Technology",
      summary: "Stub summary",
    },
  },
};

test("buildIndexedSearchText lowercases, deduplicates, and ignores null values", () => {
  const searchText = buildIndexedSearchText({
    id: "video_1",
    title: "  AI Demo  ",
    description: "Stub summary",
    caption: null,
    creator_name: "YouTube Creator",
    creator_handle: "@Creator",
    platform: "youtube",
    language: "en",
    tags: [
      { tag: "AI", source: "ai" },
      { tag: "technology", source: "ai" },
      { tag: "AI", source: "user" },
    ],
    collections: [{ id: "c1", name: "Productivity", type: "smart" }],
    analysis: {
      topic: "AI",
      vertical_fields_json: {
        category: "Technology",
        summary: "Stub summary",
      },
    },
    summary: "Stub summary",
  });

  assert.equal(
    searchText,
    "ai demo stub summary youtube creator @creator youtube en ai technology productivity",
  );
});

test("processIndexVideo enqueues refresh_smart_collections", async () => {
  const calls: string[] = [];
  const searchText = await processIndexVideo("video_1", {
    loadVideo: async () => ({
      ...baseVideo,
      title: "Title",
      description: "Description",
      caption: null,
      creator_handle: "@creator",
      language: "en",
      collections: [],
      summary: "Stub summary",
    }),
    updateVideoSearchText: async () => {
      calls.push("update");
    },
    enqueueRefreshSmartCollections: async (videoId) => {
      calls.push(`refresh:${videoId}`);
    },
  });

  assert.equal(searchText.includes("title"), true);
  assert.deepEqual(calls, ["update", "refresh:video_1"]);
});

test("tag_contains match", () => {
  assert.equal(evaluateSmartCollectionRule({ type: "tag_contains", value: "ai" }, baseVideo), true);
});

test("tag_contains no match", () => {
  assert.equal(evaluateSmartCollectionRule({ type: "tag_contains", value: "fitness" }, baseVideo), false);
});

test("topic_equals match", () => {
  assert.equal(evaluateSmartCollectionRule({ type: "topic_equals", value: "technology" }, baseVideo), true);
});

test("topic_equals no match", () => {
  assert.equal(evaluateSmartCollectionRule({ type: "topic_equals", value: "beauty" }, baseVideo), false);
});

test("creator_equals match", () => {
  assert.equal(evaluateSmartCollectionRule({ type: "creator_equals", value: "youtube creator" }, baseVideo), true);
});

test("creator_equals no match", () => {
  assert.equal(evaluateSmartCollectionRule({ type: "creator_equals", value: "other creator" }, baseVideo), false);
});

test("platform_equals match", () => {
  assert.equal(evaluateSmartCollectionRule({ type: "platform_equals", value: "youtube" }, baseVideo), true);
});

test("platform_equals no match", () => {
  assert.equal(evaluateSmartCollectionRule({ type: "platform_equals", value: "tiktok" }, baseVideo), false);
});

test("evaluateSmartCollectionRules treats the rule list as OR", () => {
  assert.equal(
    evaluateSmartCollectionRules(
      [
        { type: "topic_equals", value: "beauty" },
        { type: "tag_contains", value: "ai" },
      ],
      baseVideo,
    ),
    true,
  );
});

test("processRefreshSmartCollections adds and removes membership idempotently", async () => {
  const membership = new Set<string>();
  const calls: string[] = [];
  let currentRules = [{ type: "tag_contains", value: "ai" }];

  const deps = {
    loadVideo: async () => baseVideo,
    listSmartCollections: async () => [
      { id: "collection_1", user_id: "user_1", rules_json: currentRules },
    ],
    hasMembership: async (collectionId: string, videoId: string) => membership.has(`${collectionId}:${videoId}`),
    addMembership: async (collectionId: string, videoId: string) => {
      membership.add(`${collectionId}:${videoId}`);
      calls.push(`add:${collectionId}`);
    },
    removeMembership: async (collectionId: string, videoId: string) => {
      membership.delete(`${collectionId}:${videoId}`);
      calls.push(`remove:${collectionId}`);
    },
  };

  await processRefreshSmartCollections("video_1", deps);
  currentRules = [{ type: "tag_contains", value: "fitness" }];
  await processRefreshSmartCollections("video_1", deps);
  await processRefreshSmartCollections("video_1", deps);

  assert.deepEqual(calls, ["add:collection_1", "remove:collection_1"]);
  assert.equal(membership.has("collection_1:video_1"), false);
});
