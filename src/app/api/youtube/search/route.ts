import type { MealCategory, Preferences, YouTubeMealCandidate } from "@/types";

export const runtime = "nodejs";

const CACHE_TTL_MS = 30 * 60 * 1000;
const searchCache = new Map<
  string,
  { expiresAt: number; videos: YouTubeMealCandidate[] }
>();

const allergySearchTerms: Record<string, string[]> = {
  Dairy: ["milk", "cheese", "cream", "butter"],
  Eggs: ["egg"],
  Gluten: ["wheat", "bread", "pasta"],
  Nuts: ["peanut", "almond", "cashew", "walnut"],
  Shellfish: ["shrimp", "prawn", "crab", "lobster"],
  Soy: ["soy", "tofu", "miso"],
};

interface SearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
}

interface VideoItem {
  id?: string;
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean; privacyStatus?: string };
}

function decodeEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function parseDuration(value = "") {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function inferCategory(value: string, preferred: MealCategory[]): MealCategory {
  const normalized = value.toLowerCase();
  const matches: [MealCategory, string[]][] = [
    ["Pasta", ["pasta", "spaghetti", "lasagna", "noodle"]],
    ["Seafood", ["salmon", "fish", "shrimp", "tuna", "seafood"]],
    ["Asian", ["asian", "thai", "korean", "chinese", "japanese", "curry"]],
    ["Italian", ["italian", "pizza", "risotto", "carbonara"]],
    ["Mediterranean", ["mediterranean", "greek", "falafel", "hummus"]],
    ["Vegetarian", ["vegetarian", "vegan", "plant based"]],
    ["High protein", ["high protein", "protein", "chicken", "beef"]],
    ["Quick meals", ["quick", "easy", "minute", "one pan"]],
  ];
  return matches.find(([, terms]) => terms.some((term) => normalized.includes(term)))?.[0]
    ?? preferred[0]
    ?? "Quick meals";
}

function blockedTerms(preferences: Preferences) {
  return [
    ...preferences.allergies.flatMap((allergy) => allergySearchTerms[allergy] ?? []),
    ...preferences.dislikedIngredients,
  ]
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

function buildQuery(preferences: Preferences) {
  const positive = [
    preferences.dietary === "Everything" ? "" : preferences.dietary,
    preferences.categories.slice(0, 3).join(" OR "),
    "easy dinner recipe cooking",
  ].filter(Boolean);
  const negative = blockedTerms(preferences).slice(0, 8).map((term) => `-${term.replaceAll(" ", "-")}`);
  return [...positive, ...negative].join(" ");
}

async function youtubeJson<T>(url: URL) {
  const response = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!response.ok) {
    throw new Error(`YouTube request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function POST(request: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        code: "YOUTUBE_API_UNAVAILABLE",
        fallback: true,
        message: "Add YOUTUBE_API_KEY to .env.local to enable the live cooking-video feed.",
      },
      { status: 503 },
    );
  }

  let preferences: Preferences;
  try {
    const body = await request.json() as { preferences?: Preferences };
    if (!body.preferences) {
      return Response.json(
        { code: "INVALID_REQUEST", message: "Meal preferences are required." },
        { status: 400 },
      );
    }
    preferences = body.preferences;
  } catch {
    return Response.json(
      { code: "INVALID_REQUEST", message: "A valid JSON request body is required." },
      { status: 400 },
    );
  }

  try {
    const cacheKey = JSON.stringify(preferences);
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json({ videos: cached.videos, cached: true });
    }

    const query = buildQuery(preferences);
    const searchRequests = ["short", "medium"].map((duration) => {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.search = new URLSearchParams({
        key: apiKey,
        part: "snippet",
        q: query,
        type: "video",
        maxResults: "15",
        safeSearch: "moderate",
        videoEmbeddable: "true",
        videoDuration: duration,
        relevanceLanguage: "en",
      }).toString();
      return youtubeJson<{ items?: SearchItem[] }>(url);
    });

    const searchResults = await Promise.all(searchRequests);
    const uniqueItems = new Map<string, SearchItem>();
    searchResults.flatMap((result) => result.items ?? []).forEach((item) => {
      const id = item.id?.videoId;
      if (id) uniqueItems.set(id, item);
    });

    const ids = [...uniqueItems.keys()];
    if (ids.length === 0) {
      return Response.json({ videos: [], cached: false });
    }

    const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailsUrl.search = new URLSearchParams({
      key: apiKey,
      part: "contentDetails,status",
      id: ids.join(","),
    }).toString();
    const details = await youtubeJson<{ items?: VideoItem[] }>(detailsUrl);
    const detailById = new Map((details.items ?? []).map((item) => [item.id, item]));
    const excluded = blockedTerms(preferences);

    const videos = ids.flatMap((id): YouTubeMealCandidate[] => {
      const item = uniqueItems.get(id);
      const detail = detailById.get(id);
      const snippet = item?.snippet;
      if (!snippet || !detail?.status?.embeddable || detail.status.privacyStatus === "private") return [];

      const title = decodeEntities(snippet.title ?? "Cooking video");
      const description = decodeEntities(snippet.description ?? "");
      const searchable = `${title} ${description}`.toLowerCase();
      if (excluded.some((term) => searchable.includes(term))) return [];

      const thumbnail =
        snippet.thumbnails?.high?.url
        ?? snippet.thumbnails?.medium?.url
        ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      return [{
        videoId: id,
        title,
        description,
        channelTitle: decodeEntities(snippet.channelTitle ?? "YouTube creator"),
        thumbnail,
        durationSeconds: parseDuration(detail.contentDetails?.duration),
        category: inferCategory(`${title} ${description}`, preferences.categories),
        sourceUrl: `https://www.youtube.com/watch?v=${id}`,
      }];
    }).slice(0, 20);

    searchCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, videos });
    return Response.json({ videos, cached: false });
  } catch (error) {
    console.error("YouTube search failed", error);
    return Response.json(
      {
        code: "YOUTUBE_API_FAILED",
        fallback: true,
        message: "Live video discovery is temporarily unavailable. Demo meals are ready instead.",
      },
      { status: 502 },
    );
  }
}
