import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";
process.env.GEMINI_API_KEY ??= "gemini-key";

const { analyzeVideoMetadata } = await import("../src/worker/analyzers/videoAnalyzer.js");
const { buildIndexedSearchText, processIndexVideo } = await import("../src/worker/handlers/indexVideo.js");
const { processAnalyzeVideo } = await import("../src/worker/handlers/analyzeVideo.js");
const {
  evaluateSmartCollectionRule,
  evaluateSmartCollectionRules,
  processRefreshSmartCollections,
} = await import("../src/worker/handlers/refreshSmartCollections.js");

const baseVideo = {
  id: "video_1",
  user_id: "user_1",
  platform: "youtube",
  platform_video_id: "abc123",
  hashtags: ["ai"],
  creator_name: "YouTube Creator",
  tags: [{ tag: "ai", source: "ai" }],
  analysis: {
    topic: "Technology",
    vertical_fields_json: {
      summary: "Stub summary",
    },
  },
};

function makeGeminiPayload(text: string): Record<string, unknown> {
  return {
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
  };
}

async function withMockGeminiFetch<T>(responses: string[], fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = (async () => {
    const index = Math.min(callCount, responses.length - 1);
    callCount += 1;

    return {
      ok: true,
      status: 200,
      json: async () => makeGeminiPayload(responses[index] ?? responses[responses.length - 1] ?? ""),
    } as any;
  }) as typeof fetch;

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

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

test("processAnalyzeVideo returns ready and completed, and enqueues index_video", async () => {
  const calls: string[] = [];
  const result = await withMockGeminiFetch(
    [
      JSON.stringify({
        summary: "Educational YouTube video about AI prompting basics for beginners.",
        topic: "AI",
        format: "tutorial",
        intent: "teach",
        audience: "students and learners",
        vertical_type: "education",
        quality_score: 88,
        confidence: 0.82,
        tags: ["ai", "prompt_engineering", "chatgpt", "beginners", "tutorial", "education"],
        vertical_fields: {
          topic_area: "ai",
          difficulty: "beginner",
          learning_goal: "Understand AI prompting basics",
        },
      }),
    ],
    async () =>
      processAnalyzeVideo("video_1", {
        loadVideo: async () => ({
          ...baseVideo,
          source_url: "https://www.youtube.com/shorts/abc123",
          normalized_url: "https://www.youtube.com/shorts/abc123",
          platform: "youtube",
          title: "Title",
          description: "Description",
          caption: "Learn prompt engineering basics.",
          creator_handle: "@creator",
          language: "en",
        }),
        insertVideoAnalysis: async (videoId, analysis) => {
          calls.push(`analysis:${videoId}:${analysis.topic}:${analysis.tags.join(",")}`);
        },
        insertVideoTags: async (videoId, tags) => {
          calls.push(`tags:${videoId}:${tags.join(",")}`);
        },
        updateVideoFinalStatus: async (videoId, summary, searchText) => {
          calls.push(`status:${videoId}:${summary.includes("AI prompting basics")}:${searchText.toLowerCase().includes("students and learners")}`);
        },
        enqueueIndexVideo: async (videoId, userId) => {
          calls.push(`index:${videoId}:${userId}`);
        },
      }),
  );

  assert.deepEqual(result, {
    videoId: "video_1",
    status: "ready",
    analysis_status: "completed",
  });
  assert.deepEqual(calls, [
    "analysis:video_1:AI:ai,prompt_engineering,chatgpt,beginners,tutorial,education",
    "tags:video_1:ai,prompt_engineering,chatgpt,beginners,tutorial,education",
    "status:video_1:true:true",
    "index:video_1:user_1",
  ]);
});

test("analyzeVideoMetadata classifies educational YouTube metadata", async () => {
  const result = await withMockGeminiFetch(
    [
      JSON.stringify({
        summary: "A step-by-step guide to writing better prompts for ChatGPT and other LLMs.",
        topic: "AI",
        format: "tutorial",
        intent: "teach",
        audience: "beginners",
        vertical_type: "education",
        quality_score: 95,
        confidence: 0.9,
        tags: ["chatgpt", "prompt_engineering", "ai", "tutorial", "beginners"],
        vertical_fields: {
          topic_area: "ai",
          difficulty: "beginner",
          learning_goal: "Learn prompt patterns and structure",
        },
      }),
    ],
    async () =>
      analyzeVideoMetadata({
        title: "ChatGPT Prompt Engineering Tutorial for Beginners",
        description: "A step-by-step guide to writing better prompts for ChatGPT and other LLMs.",
        caption: "Learn prompt patterns, prompt structure, and beginner mistakes.",
        hashtags: ["#ChatGPT", "#PromptEngineering", "#AITutorial"],
        creator_name: "AI Academy",
        creator_handle: "@aiacademy",
        platform: "youtube",
        language: "en",
      }),
  );

  assert.equal(result.topic, "AI");
  assert.equal(result.vertical_type, "education");
  assert.equal(result.format, "tutorial");
  assert.equal(result.intent, "teach");
  assert.equal(result.vertical_fields.topic_area, "ai");
  assert.equal(result.tags.includes("prompt_engineering"), true);
});

test("analyzeVideoMetadata classifies beauty and fashion Instagram metadata", async () => {
  const result = await withMockGeminiFetch(
    [
      JSON.stringify({
        summary: "Soft glam makeup, skincare prep, and a casual streetwear look for summer.",
        topic: "Beauty",
        format: "showcase",
        intent: "demonstrate",
        audience: "beauty and fashion enthusiasts",
        vertical_type: "beauty_fashion",
        quality_score: 90,
        confidence: 0.85,
        tags: ["makeup", "streetwear", "clean_girl", "beauty", "fashion"],
        vertical_fields: {
          product_type: "makeup",
          style: "casual",
          aesthetic: "clean girl",
        },
      }),
    ],
    async () =>
      analyzeVideoMetadata({
        title: "Clean Girl Makeup and Minimalist Outfit Combo",
        description: "Soft glam makeup, skincare prep, and a casual streetwear look for summer.",
        caption: "Minimalist beauty routine with outfit details.",
        hashtags: ["#makeup", "#streetwear", "#cleangirl"],
        creator_name: "Style Lab",
        creator_handle: "@stylelab",
        platform: "instagram",
        language: "en",
      }),
  );

  assert.equal(result.vertical_type, "beauty_fashion");
  assert.equal(result.topic === "Beauty" || result.topic === "Fashion", true);
  assert.equal(typeof result.vertical_fields.style, "string");
  assert.equal(result.tags.some((tag) => tag.includes("makeup") || tag.includes("streetwear")), true);
});

test("analyzeVideoMetadata classifies general entertainment content conservatively", async () => {
  const result = await withMockGeminiFetch(
    [
      JSON.stringify({
        summary: "A short comedy sketch with chaotic roommate energy.",
        topic: "Entertainment",
        format: "story",
        intent: "entertain",
        audience: "general entertainment audience",
        vertical_type: "entertainment",
        quality_score: 84,
        confidence: 0.72,
        tags: ["comedy", "skit", "roommates", "late_night", "snacks"],
        vertical_fields: {
          style: "comedy",
          mood: "funny",
          hook: "roommates and late-night snacks",
        },
      }),
    ],
    async () =>
      analyzeVideoMetadata({
        title: "Funny skit about roommates and late-night snacks",
        description: "A short comedy sketch with chaotic roommate energy.",
        caption: "",
        hashtags: ["#comedy", "#skit"],
        creator_name: "Laugh Track",
        creator_handle: "@laughtrack",
        platform: "instagram",
        language: "en",
      }),
  );

  assert.equal(result.topic, "Entertainment");
  assert.equal(result.vertical_type, "entertainment");
  assert.equal(result.intent === "entertain" || result.intent === "inform", true);
  assert.equal(typeof result.vertical_fields.mood, "string");
});

test("analyzeVideoMetadata uses low confidence for sparse metadata", async () => {
  const result = await withMockGeminiFetch(["not valid json", "still invalid"], async () =>
    analyzeVideoMetadata({
      title: "",
      description: "",
      caption: "",
      hashtags: [],
      creator_name: "",
      creator_handle: "",
      platform: "youtube",
      language: "",
    }),
  );

  assert.equal(result.topic, "General");
  assert.equal(result.confidence <= 0.3, true);
  assert.equal(result.quality_score <= 10, true);
});

test("analyzeVideoMetadata retries once on invalid JSON and repairs successfully", async () => {
  const result = await withMockGeminiFetch(
    [
      "not valid json",
      JSON.stringify({
        summary: "Metadata suggests a beginner coding lesson on JavaScript array methods.",
        topic: "Coding",
        format: "tutorial",
        intent: "teach",
        audience: "beginners",
        vertical_type: "education",
        quality_score: 99,
        confidence: 0.94,
        tags: ["javascript", "coding", "arrays", "beginners", "tutorial"],
        vertical_fields: {
          topic_area: "coding",
          difficulty: "beginner",
          learning_goal: "Learn JavaScript array methods",
        },
      }),
    ],
    async () =>
      analyzeVideoMetadata({
        title: "Beginner JavaScript array methods explained",
        description: "Learn map, filter, and reduce with simple examples.",
        caption: "",
        hashtags: ["#javascript", "#coding"],
        creator_name: "Code Coach",
        creator_handle: "@codecoach",
        platform: "youtube",
        language: "en",
      }),
  );

  assert.equal(result.topic, "Coding");
  assert.equal(result.confidence < 0.94, true);
});

test("analyzeVideoMetadata falls back safely when JSON remains invalid", async () => {
  const result = await withMockGeminiFetch(["still invalid", "still invalid"], async () =>
    analyzeVideoMetadata({
      title: "Some general post",
      description: "",
      caption: "",
      hashtags: [],
      creator_name: "",
      creator_handle: "",
      platform: "instagram",
      language: "en",
    }),
  );

  assert.equal(result.topic, "General");
  assert.equal(Array.isArray(result.tags), true);
  assert.equal(typeof result.summary, "string");
});

test("processAnalyzeVideo removes duplicate tags before persistence", async () => {
  const observed: string[] = [];

  await withMockGeminiFetch(
    [
      JSON.stringify({
        summary: "A simple test video.",
        topic: "General",
        format: "general",
        intent: "inform",
        audience: "general audience",
        vertical_type: "general",
        quality_score: 40,
        confidence: 0.4,
        tags: ["AI", "ai", "#AI", "Prompt Engineering", "prompt_engineering"],
        vertical_fields: {},
      }),
    ],
    async () =>
      processAnalyzeVideo("video_1", {
        loadVideo: async () => ({
          ...baseVideo,
          source_url: "https://www.youtube.com/shorts/abc123",
          normalized_url: "https://www.youtube.com/shorts/abc123",
          title: "Title",
          description: "Description",
          caption: "",
          creator_handle: "@creator",
          language: "en",
        }),
        insertVideoAnalysis: async (_videoId, analysis) => {
          observed.push(`analysis:${analysis.tags.join(",")}`);
        },
        insertVideoTags: async (_videoId, tags) => {
          observed.push(`tags:${tags.join(",")}`);
        },
        updateVideoFinalStatus: async () => {},
        enqueueIndexVideo: async () => {},
      }),
  );

  assert.deepEqual(observed, [
    "analysis:ai,prompt_engineering,title,description,youtube",
    "tags:ai,prompt_engineering,title,description,youtube",
  ]);
});

test("processAnalyzeVideo transitions status to ready on success", async () => {
  const statusArgs: Array<{ summary: string; searchText: string }> = [];

  const result = await withMockGeminiFetch(
    [
      JSON.stringify({
        summary: "A production-ready metadata analysis test case.",
        topic: "Technology",
        format: "demo",
        intent: "demonstrate",
        audience: "developers and tech learners",
        vertical_type: "education",
        quality_score: 70,
        confidence: 0.65,
        tags: ["technology", "demo", "metadata", "analysis", "developers"],
        vertical_fields: {
          topic_area: "technology",
          difficulty: "beginner",
          learning_goal: "Understand metadata analysis",
        },
      }),
    ],
    async () =>
      processAnalyzeVideo("video_1", {
        loadVideo: async () => ({
          ...baseVideo,
          source_url: "https://www.youtube.com/shorts/abc123",
          normalized_url: "https://www.youtube.com/shorts/abc123",
          title: "Title",
          description: "Description",
          caption: "",
          creator_handle: "@creator",
          language: "en",
        }),
        insertVideoAnalysis: async () => {},
        insertVideoTags: async () => {},
        updateVideoFinalStatus: async (_videoId, summary, searchText) => {
          statusArgs.push({ summary, searchText });
        },
        enqueueIndexVideo: async () => {},
      }),
  );

  assert.deepEqual(result, {
    videoId: "video_1",
    status: "ready",
    analysis_status: "completed",
  });
  const args = statusArgs[0];
  assert.ok(args);
  assert.equal(args.summary, "A production-ready metadata analysis test case.");
  assert.equal(args.searchText.includes("developers and tech learners"), true);
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
