import { env } from "../../config/env.js";
import { normalizeTag } from "../../lib/video.js";

export type VideoMetadataInput = {
  title: string;
  description: string;
  caption: string;
  hashtags: string[];
  creator_name: string;
  creator_handle: string;
  platform: string;
  language: string;
};

export type VideoTopic =
  | "AI"
  | "Technology"
  | "Coding"
  | "Business"
  | "Marketing"
  | "Finance"
  | "Education"
  | "Productivity"
  | "Fitness"
  | "Health"
  | "Food"
  | "Travel"
  | "Beauty"
  | "Fashion"
  | "Lifestyle"
  | "Gaming"
  | "Entertainment"
  | "Music"
  | "News"
  | "Sports"
  | "DIY"
  | "Design"
  | "General";

export type VideoFormat =
  | "tutorial"
  | "how_to"
  | "review"
  | "comparison"
  | "news"
  | "opinion"
  | "interview"
  | "demo"
  | "showcase"
  | "story"
  | "vlog"
  | "podcast_clip"
  | "general";

export type VideoIntent =
  | "teach"
  | "inform"
  | "entertain"
  | "sell"
  | "promote"
  | "inspire"
  | "review"
  | "compare"
  | "demonstrate"
  | "document"
  | "opinion";

export type VerticalType =
  | "recipe"
  | "workout"
  | "tutorial_diy"
  | "beauty_fashion"
  | "education"
  | "entertainment"
  | "general";

export type VideoMetadataAnalysis = {
  summary: string;
  topic: VideoTopic;
  format: VideoFormat;
  intent: VideoIntent;
  audience: string;
  vertical_type: VerticalType;
  quality_score: number;
  confidence: number;
  tags: string[];
  vertical_fields: Record<string, unknown>;
};

const ALLOWED_TOPICS: VideoTopic[] = [
  "AI",
  "Technology",
  "Coding",
  "Business",
  "Marketing",
  "Finance",
  "Education",
  "Productivity",
  "Fitness",
  "Health",
  "Food",
  "Travel",
  "Beauty",
  "Fashion",
  "Lifestyle",
  "Gaming",
  "Entertainment",
  "Music",
  "News",
  "Sports",
  "DIY",
  "Design",
  "General",
];

const ALLOWED_FORMATS: VideoFormat[] = [
  "tutorial",
  "how_to",
  "review",
  "comparison",
  "news",
  "opinion",
  "interview",
  "demo",
  "showcase",
  "story",
  "vlog",
  "podcast_clip",
  "general",
];

const ALLOWED_INTENTS: VideoIntent[] = [
  "teach",
  "inform",
  "entertain",
  "sell",
  "promote",
  "inspire",
  "review",
  "compare",
  "demonstrate",
  "document",
  "opinion",
];

const ALLOWED_VERTICAL_TYPES: VerticalType[] = [
  "recipe",
  "workout",
  "tutorial_diy",
  "beauty_fashion",
  "education",
  "entertainment",
  "general",
];

const GENERIC_TAGS = new Set([
  "video",
  "content",
  "creator",
  "shorts",
  "short",
  "reel",
  "reels",
  "viral",
]);

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you",
  "your",
]);

const ANALYZER_SYSTEM_PROMPT = `You analyze short-form video metadata only.

Rules:
- Analyze ONLY the provided metadata.
- Never use audio, video frames, OCR, or transcription.
- Never hallucinate facts.
- Be conservative when metadata is weak.
- Return valid JSON only.
- Use exactly the requested keys.
- If metadata is insufficient, use "General", "general", empty strings, empty arrays, or {} as appropriate.
- quality_score must measure metadata richness only, not content quality.
- confidence must be between 0.0 and 1.0 and should be low when metadata is sparse.
- summary must be 200 characters or fewer and based only on metadata.
- tags must be 5-10 search-helpful tags when the metadata supports them, lowercase, no hashtags, no duplicates.

Allowed topics: ${ALLOWED_TOPICS.join(", ")}
Allowed formats: ${ALLOWED_FORMATS.join(", ")}
Allowed intents: ${ALLOWED_INTENTS.join(", ")}
Allowed vertical types: ${ALLOWED_VERTICAL_TYPES.join(", ")}

Vertical field shapes:
- recipe: {"ingredients":[],"cuisine":"","meal_type":"","diet_type":""}
- workout: {"muscle_group":[],"workout_type":"","equipment":[],"goal":""}
- tutorial_diy: {"tools":[],"materials":[],"skill_level":""}
- beauty_fashion: {"product_type":"","style":"","aesthetic":""}
- education: {"topic_area":"","difficulty":"","learning_goal":""}
- entertainment: {"style":"","mood":"","hook":""}
- general: {}`;

function trimText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength).trim();
}

function toMetadata(input: Partial<VideoMetadataInput>): VideoMetadataInput {
  return {
    title: trimText(input.title ?? "", 500),
    description: trimText(input.description ?? "", 4_000),
    caption: trimText(input.caption ?? "", 4_000),
    hashtags: Array.isArray(input.hashtags)
      ? input.hashtags.filter((value): value is string => typeof value === "string").map((value) => trimText(value, 100))
      : [],
    creator_name: trimText(input.creator_name ?? "", 200),
    creator_handle: trimText(input.creator_handle ?? "", 200),
    platform: trimText(input.platform ?? "", 50),
    language: trimText(input.language ?? "", 50),
  };
}

function buildUserPrompt(metadata: VideoMetadataInput): string {
  return [
    "Analyze this video metadata and return JSON only.",
    "",
    JSON.stringify(metadata, null, 2),
    "",
    'Return exactly: {"summary":"","topic":"","format":"","intent":"","audience":"","vertical_type":"","quality_score":0,"confidence":0,"tags":[],"vertical_fields":{}}',
  ].join("\n");
}

function buildRepairPrompt(rawText: string): string {
  return [
    "Repair the following model output into valid JSON only.",
    "Do not add commentary.",
    'Use exactly: {"summary":"","topic":"","format":"","intent":"","audience":"","vertical_type":"","quality_score":0,"confidence":0,"tags":[],"vertical_fields":{}}',
    "",
    rawText,
  ].join("\n");
}

function getTextBlob(metadata: VideoMetadataInput): string {
  return [
    metadata.title,
    metadata.description,
    metadata.caption,
    metadata.hashtags.join(" "),
    metadata.creator_name,
    metadata.creator_handle,
    metadata.platform,
    metadata.language,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function containsAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function computeQualityScore(metadata: VideoMetadataInput): number {
  let score = 0;

  if (metadata.title) {
    score += metadata.title.length >= 20 ? 25 : 15;
  }
  if (metadata.description) {
    score += metadata.description.length >= 120 ? 20 : 12;
  }
  if (metadata.caption) {
    score += metadata.caption.length >= 120 ? 20 : 12;
  }
  if (metadata.hashtags.length > 0) {
    score += Math.min(15, 5 + metadata.hashtags.length * 2);
  }
  if (metadata.creator_name) {
    score += 5;
  }
  if (metadata.creator_handle) {
    score += 5;
  }
  if (metadata.platform) {
    score += 5;
  }
  if (metadata.language) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

function computeConfidenceCap(qualityScore: number): number {
  const capped = 0.15 + qualityScore / 100 * 0.75;
  return Math.round(Math.min(0.95, capped) * 100) / 100;
}

function inferTopic(metadata: VideoMetadataInput): VideoTopic {
  const text = getTextBlob(metadata);

  if (containsAny(text, ["chatgpt", "openai", "anthropic", "deepseek", "llm", "prompt engineering", "artificial intelligence", " ai "])) {
    return "AI";
  }
  if (containsAny(text, ["javascript", "typescript", "python", "coding", "programming", "developer", "software engineer", "react", "api"])) {
    return "Coding";
  }
  if (containsAny(text, ["design", "ui", "ux", "graphic design", "branding", "figma"])) {
    return "Design";
  }
  if (containsAny(text, ["marketing", "seo", "ads", "campaign", "brand strategy"])) {
    return "Marketing";
  }
  if (containsAny(text, ["startup", "business", "founder", "saas", "sales", "operations"])) {
    return "Business";
  }
  if (containsAny(text, ["investing", "stocks", "finance", "money", "budget", "crypto"])) {
    return "Finance";
  }
  if (containsAny(text, ["lesson", "education", "learn", "study", "explained", "lecture", "history", "science"])) {
    return "Education";
  }
  if (containsAny(text, ["productivity", "notion", "workflow", "focus", "time management"])) {
    return "Productivity";
  }
  if (containsAny(text, ["workout", "fitness", "gym", "exercise", "training", "hiit", "pilates", "yoga"])) {
    return "Fitness";
  }
  if (containsAny(text, ["health", "wellness", "nutrition", "mental health", "recovery"])) {
    return "Health";
  }
  if (containsAny(text, ["recipe", "cook", "cooking", "meal", "bake", "food"])) {
    return "Food";
  }
  if (containsAny(text, ["travel", "trip", "vacation", "itinerary", "hotel", "destination"])) {
    return "Travel";
  }
  if (containsAny(text, ["makeup", "skincare", "beauty", "cosmetic"])) {
    return "Beauty";
  }
  if (containsAny(text, ["fashion", "outfit", "style", "wardrobe", "streetwear"])) {
    return "Fashion";
  }
  if (containsAny(text, ["daily routine", "lifestyle", "day in my life", "home decor"])) {
    return "Lifestyle";
  }
  if (containsAny(text, ["gaming", "gameplay", "streamer", "walkthrough", "esports"])) {
    return "Gaming";
  }
  if (containsAny(text, ["song", "music", "album", "cover", "remix", "beat"])) {
    return "Music";
  }
  if (containsAny(text, ["breaking", "headline", "news", "update", "report"])) {
    return "News";
  }
  if (containsAny(text, ["football", "soccer", "basketball", "cricket", "sports", "match"])) {
    return "Sports";
  }
  if (containsAny(text, ["diy", "craft", "woodworking", "home improvement", "build"])) {
    return "DIY";
  }
  if (containsAny(text, ["comedy", "funny", "prank", "skit", "dance", "celebrity"])) {
    return "Entertainment";
  }
  if (containsAny(text, ["tech", "technology", "gadget", "software", "hardware", "app review"])) {
    return "Technology";
  }

  return "General";
}

function inferFormat(metadata: VideoMetadataInput): VideoFormat {
  const text = getTextBlob(metadata);

  if (containsAny(text, ["tutorial", "step by step"])) {
    return "tutorial";
  }
  if (containsAny(text, ["how to", "tips", "guide"])) {
    return "how_to";
  }
  if (containsAny(text, ["review", "tested", "unboxing"])) {
    return "review";
  }
  if (containsAny(text, ["vs", "versus", "comparison", "compare"])) {
    return "comparison";
  }
  if (containsAny(text, ["breaking", "news", "update"])) {
    return "news";
  }
  if (containsAny(text, ["i think", "my take", "opinion", "rant"])) {
    return "opinion";
  }
  if (containsAny(text, ["interview", "q&a", "podcast guest"])) {
    return "interview";
  }
  if (containsAny(text, ["demo", "walkthrough", "showing"])) {
    return "demo";
  }
  if (containsAny(text, ["showcase", "portfolio", "highlight"])) {
    return "showcase";
  }
  if (containsAny(text, ["storytime", "story", "journey"])) {
    return "story";
  }
  if (containsAny(text, ["day in my life", "vlog", "behind the scenes"])) {
    return "vlog";
  }
  if (containsAny(text, ["podcast clip", "podcast"])) {
    return "podcast_clip";
  }

  return "general";
}

function inferIntent(metadata: VideoMetadataInput, format: VideoFormat): VideoIntent {
  const text = getTextBlob(metadata);

  if (format === "tutorial" || format === "how_to") {
    return "teach";
  }
  if (format === "review") {
    return "review";
  }
  if (format === "comparison") {
    return "compare";
  }
  if (format === "demo" || format === "showcase") {
    return "demonstrate";
  }
  if (format === "story" || format === "vlog") {
    return "document";
  }
  if (format === "opinion") {
    return "opinion";
  }
  if (containsAny(text, ["buy", "shop", "discount", "sale", "link in bio"])) {
    return "sell";
  }
  if (containsAny(text, ["follow", "subscribe", "launch", "available now", "sign up"])) {
    return "promote";
  }
  if (containsAny(text, ["motivation", "inspire", "mindset"])) {
    return "inspire";
  }
  if (containsAny(text, ["funny", "comedy", "joke", "prank"])) {
    return "entertain";
  }

  return "inform";
}

function inferAudience(topic: VideoTopic, metadata: VideoMetadataInput): string {
  const text = getTextBlob(metadata);

  if (containsAny(text, ["beginner", "for beginners"])) {
    return "beginners";
  }

  switch (topic) {
    case "AI":
    case "Coding":
    case "Technology":
      return "developers and tech learners";
    case "Business":
    case "Marketing":
      return "founders and marketers";
    case "Finance":
      return "investors and finance learners";
    case "Education":
      return "students and learners";
    case "Fitness":
      return "fitness enthusiasts";
    case "Health":
      return "health-conscious viewers";
    case "Food":
      return "home cooks";
    case "Travel":
      return "travel enthusiasts";
    case "Beauty":
    case "Fashion":
      return "beauty and fashion enthusiasts";
    case "Gaming":
      return "gamers";
    case "Sports":
      return "sports fans";
    case "Entertainment":
    case "Music":
      return "general entertainment audience";
    default:
      return "general audience";
  }
}

function inferVerticalType(topic: VideoTopic, format: VideoFormat, metadata: VideoMetadataInput): VerticalType {
  const text = getTextBlob(metadata);

  if (containsAny(text, ["recipe", "cook", "ingredients", "meal prep", "bake"])) {
    return "recipe";
  }
  if (containsAny(text, ["workout", "gym", "exercise", "pilates", "yoga", "hiit"])) {
    return "workout";
  }
  if (containsAny(text, ["diy", "craft", "build", "home improvement"])) {
    return "tutorial_diy";
  }
  if (topic === "Beauty" || topic === "Fashion") {
    return "beauty_fashion";
  }
  if (
    topic === "Education" ||
    topic === "AI" ||
    topic === "Coding" ||
    topic === "Technology" ||
    format === "tutorial" ||
    format === "how_to"
  ) {
    return "education";
  }
  if (topic === "Entertainment" || topic === "Music" || topic === "Gaming") {
    return "entertainment";
  }

  return "general";
}

function parseDifficulty(text: string): string {
  if (containsAny(text, ["beginner", "intro", "101"])) {
    return "beginner";
  }
  if (containsAny(text, ["advanced", "expert"])) {
    return "advanced";
  }
  if (containsAny(text, ["intermediate"])) {
    return "intermediate";
  }
  return "";
}

function inferVerticalFields(verticalType: VerticalType, metadata: VideoMetadataInput, topic: VideoTopic): Record<string, unknown> {
  const text = getTextBlob(metadata);

  switch (verticalType) {
    case "recipe":
      return {
        ingredients: [],
        cuisine: containsAny(text, ["italian", "mexican", "indian", "japanese", "thai"]) ? trimText(text.match(/\b(italian|mexican|indian|japanese|thai)\b/)?.[0] ?? "", 50) : "",
        meal_type: containsAny(text, ["breakfast", "lunch", "dinner", "dessert", "snack"]) ? trimText(text.match(/\b(breakfast|lunch|dinner|dessert|snack)\b/)?.[0] ?? "", 50) : "",
        diet_type: containsAny(text, ["vegan", "vegetarian", "keto", "gluten free", "high protein"]) ? trimText(text.match(/\b(vegan|vegetarian|keto|gluten free|high protein)\b/)?.[0] ?? "", 50) : "",
      };
    case "workout":
      return {
        muscle_group: ["legs", "glutes", "back", "chest", "arms", "core", "shoulders"].filter((group) => text.includes(group)),
        workout_type: containsAny(text, ["hiit", "strength", "cardio", "pilates", "yoga", "mobility"])
          ? trimText(text.match(/\b(hiit|strength|cardio|pilates|yoga|mobility)\b/)?.[0] ?? "", 50)
          : "",
        equipment: ["dumbbells", "barbell", "kettlebell", "band", "mat", "bodyweight"].filter((item) => text.includes(item)),
        goal: containsAny(text, ["fat loss", "muscle gain", "strength", "mobility", "endurance"])
          ? trimText(text.match(/\b(fat loss|muscle gain|strength|mobility|endurance)\b/)?.[0] ?? "", 50)
          : "",
      };
    case "tutorial_diy":
      return {
        tools: [],
        materials: [],
        skill_level: parseDifficulty(text),
      };
    case "beauty_fashion":
      return {
        product_type: containsAny(text, ["skincare", "makeup", "foundation", "lipstick", "outfit", "haircare"])
          ? trimText(text.match(/\b(skincare|makeup|foundation|lipstick|outfit|haircare)\b/)?.[0] ?? "", 50)
          : "",
        style: containsAny(text, ["casual", "streetwear", "formal", "glam", "minimalist"])
          ? trimText(text.match(/\b(casual|streetwear|formal|glam|minimalist)\b/)?.[0] ?? "", 50)
          : "",
        aesthetic: containsAny(text, ["clean girl", "soft glam", "coquette", "minimalist", "bold"])
          ? trimText(text.match(/\b(clean girl|soft glam|coquette|minimalist|bold)\b/)?.[0] ?? "", 50)
          : "",
      };
    case "education":
      return {
        topic_area: topic === "General" ? "" : topic.toLowerCase(),
        difficulty: parseDifficulty(text),
        learning_goal: metadata.title ? trimText(metadata.title, 120) : "",
      };
    case "entertainment":
      return {
        style: containsAny(text, ["comedy", "story", "music", "gaming", "reaction"])
          ? trimText(text.match(/\b(comedy|story|music|gaming|reaction)\b/)?.[0] ?? "", 50)
          : "",
        mood: containsAny(text, ["funny", "dramatic", "chill", "hype", "emotional"])
          ? trimText(text.match(/\b(funny|dramatic|chill|hype|emotional)\b/)?.[0] ?? "", 50)
          : "",
        hook: metadata.title ? trimText(metadata.title, 120) : "",
      };
    default:
      return {};
  }
}

function extractCandidateTags(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function sanitizeTags(tags: unknown, metadata: VideoMetadataInput): string[] {
  const rawTags = Array.isArray(tags) ? tags : [];
  const seen = new Set<string>();
  const cleaned: string[] = [];

  const pushTag = (value: string): void => {
    const withoutHash = value.replace(/^#+/, "").trim().toLowerCase();
    const normalized = normalizeTag(withoutHash.replace(/[^a-z0-9\s_-]/g, " "));
    if (!normalized || GENERIC_TAGS.has(normalized) || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    cleaned.push(normalized);
  };

  for (const tag of rawTags) {
    if (typeof tag === "string") {
      pushTag(tag);
    }
  }

  if (cleaned.length < 5) {
    const fallbackCandidates = [
      ...metadata.hashtags,
      ...extractCandidateTags(metadata.title),
      ...extractCandidateTags(metadata.description),
      ...extractCandidateTags(metadata.caption),
      metadata.platform,
      metadata.language,
      metadata.creator_handle.replace(/^@/, ""),
    ];

    for (const candidate of fallbackCandidates) {
      if (cleaned.length >= 5) {
        break;
      }

      if (candidate) {
        pushTag(candidate);
      }
    }
  }

  return cleaned.slice(0, 10);
}

function buildSummary(metadata: VideoMetadataInput, topic: VideoTopic): string {
  const primary = [metadata.title, metadata.description, metadata.caption].find((value) => value.length > 0) ?? "";
  if (!primary) {
    return "Metadata is limited; this appears to be general video content with unclear subject matter.";
  }

  const summary = trimText(primary, 180);
  if (summary.length <= 200 && summary.toLowerCase() !== metadata.title.toLowerCase()) {
    return summary;
  }

  return trimText(`Metadata suggests ${topic.toLowerCase()} content about ${summary.toLowerCase()}.`, 200);
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function pickAllowedValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sanitizeVerticalFields(
  verticalType: VerticalType,
  rawValue: unknown,
  metadata: VideoMetadataInput,
  topic: VideoTopic,
): Record<string, unknown> {
  const fallback = inferVerticalFields(verticalType, metadata, topic);
  const record = readObject(rawValue);
  const readString = (key: string): string => trimText(typeof record[key] === "string" ? (record[key] as string) : "", 120);

  switch (verticalType) {
    case "recipe":
      return {
        ingredients: readStringArray(record.ingredients).map((item) => trimText(item, 80)).slice(0, 20),
        cuisine: readString("cuisine") || String(fallback.cuisine ?? ""),
        meal_type: readString("meal_type") || String(fallback.meal_type ?? ""),
        diet_type: readString("diet_type") || String(fallback.diet_type ?? ""),
      };
    case "workout":
      return {
        muscle_group: readStringArray(record.muscle_group).map((item) => trimText(item, 80)).slice(0, 10),
        workout_type: readString("workout_type") || String(fallback.workout_type ?? ""),
        equipment: readStringArray(record.equipment).map((item) => trimText(item, 80)).slice(0, 10),
        goal: readString("goal") || String(fallback.goal ?? ""),
      };
    case "tutorial_diy":
      return {
        tools: readStringArray(record.tools).map((item) => trimText(item, 80)).slice(0, 15),
        materials: readStringArray(record.materials).map((item) => trimText(item, 80)).slice(0, 15),
        skill_level: readString("skill_level") || String(fallback.skill_level ?? ""),
      };
    case "beauty_fashion":
      return {
        product_type: readString("product_type") || String(fallback.product_type ?? ""),
        style: readString("style") || String(fallback.style ?? ""),
        aesthetic: readString("aesthetic") || String(fallback.aesthetic ?? ""),
      };
    case "education":
      return {
        topic_area: readString("topic_area") || String(fallback.topic_area ?? ""),
        difficulty: readString("difficulty") || String(fallback.difficulty ?? ""),
        learning_goal: readString("learning_goal") || String(fallback.learning_goal ?? ""),
      };
    case "entertainment":
      return {
        style: readString("style") || String(fallback.style ?? ""),
        mood: readString("mood") || String(fallback.mood ?? ""),
        hook: readString("hook") || String(fallback.hook ?? ""),
      };
    default:
      return {};
  }
}

function parseJsonObject(rawText: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawText) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawText.slice(start, end + 1)) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

function buildFallbackAnalysis(metadata: VideoMetadataInput): VideoMetadataAnalysis {
  const topic = inferTopic(metadata);
  const format = inferFormat(metadata);
  const qualityScore = computeQualityScore(metadata);
  const confidenceCap = computeConfidenceCap(qualityScore);
  const verticalType = inferVerticalType(topic, format, metadata);

  return {
    summary: buildSummary(metadata, topic),
    topic,
    format,
    intent: inferIntent(metadata, format),
    audience: inferAudience(topic, metadata),
    vertical_type: verticalType,
    quality_score: qualityScore,
    confidence: Math.max(0.1, Math.min(0.6, Math.round((confidenceCap - 0.1) * 100) / 100)),
    tags: sanitizeTags([], metadata),
    vertical_fields: inferVerticalFields(verticalType, metadata, topic),
  };
}

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function normalizeAnalysis(metadata: VideoMetadataInput, raw: Record<string, unknown>): VideoMetadataAnalysis {
  const fallback = buildFallbackAnalysis(metadata);
  const qualityScore = computeQualityScore(metadata);
  const confidenceCap = computeConfidenceCap(qualityScore);
  const topic = pickAllowedValue(raw.topic, ALLOWED_TOPICS, fallback.topic);
  const format = pickAllowedValue(raw.format, ALLOWED_FORMATS, fallback.format);
  const verticalType = pickAllowedValue(raw.vertical_type, ALLOWED_VERTICAL_TYPES, inferVerticalType(topic, format, metadata));

  return {
    summary: trimText(typeof raw.summary === "string" ? raw.summary : fallback.summary, 200) || fallback.summary,
    topic,
    format,
    intent: pickAllowedValue(raw.intent, ALLOWED_INTENTS, inferIntent(metadata, format)),
    audience: trimText(typeof raw.audience === "string" ? raw.audience : fallback.audience, 120) || fallback.audience,
    vertical_type: verticalType,
    quality_score: qualityScore,
    confidence: Math.round(Math.min(clampNumber(raw.confidence, 0, 1, fallback.confidence), confidenceCap) * 100) / 100,
    tags: sanitizeTags(raw.tags, metadata),
    vertical_fields: sanitizeVerticalFields(verticalType, raw.vertical_fields, metadata, topic),
  };
}

async function fetchJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`AI request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    return readObject(payload);
  } finally {
    clearTimeout(timeout);
  }
}

function extractGeminiText(payload: Record<string, unknown>): string {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const firstCandidate = readObject(candidates[0]);
  const content = readObject(firstCandidate.content);
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const texts: string[] = [];

  for (const part of parts) {
    const record = readObject(part);
    if (typeof record.text === "string") {
      texts.push(record.text);
    }
  }

  return texts.join("\n").trim();
}

async function generateGeminiContent(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    return "";
  }

  const payload = await fetchJson(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
    method: "POST",
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 700,
        responseMimeType: "application/json",
      },
    }),
  });

  return extractGeminiText(payload);
}

export async function analyzeVideoMetadata(input: Partial<VideoMetadataInput>): Promise<VideoMetadataAnalysis> {
  const metadata = toMetadata(input);
  const fallback = buildFallbackAnalysis(metadata);
  if (!env.GEMINI_API_KEY) {
    return fallback;
  }

  try {
    const rawText = await generateGeminiContent(ANALYZER_SYSTEM_PROMPT, buildUserPrompt(metadata));
    const parsed = parseJsonObject(rawText);
    if (parsed) {
      return normalizeAnalysis(metadata, parsed);
    }

    const repairedText = await generateGeminiContent(ANALYZER_SYSTEM_PROMPT, buildRepairPrompt(rawText));
    const repaired = parseJsonObject(repairedText);
    return repaired ? normalizeAnalysis(metadata, repaired) : fallback;
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "video metadata analyzer fell back to safe output",
        error: error instanceof Error ? error.message : String(error),
        platform: metadata.platform,
      }),
    );
    return fallback;
  }
}
