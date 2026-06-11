import type { ProviderResponse } from "@/services/types";
import type { WebSearchSource } from "@/types/aion";
import {
  fetchJsonWithTimeout,
  getTimeoutMs,
  missingProviderConfig,
  providerFailure,
  truncate
} from "@/providers/providerUtils";

type WebSearchOptions = {
  query: string;
  timeoutMs?: number;
  maxResults?: number;
};

type TavilySearchResponse = {
  query?: string;
  results?: TavilyResult[];
};

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
};

type SearchContextSource = WebSearchSource & {
  snippet?: string;
  publishedDate?: string;
};

const DEFAULT_MAX_RESULTS = 6;
const DEFAULT_SEARCH_DEPTH = "basic";
const TAVILY_MAX_QUERY_LENGTH = 380;
const SEARCH_DEPTHS = new Set(["basic", "fast", "ultra-fast", "advanced"]);

export async function callResearchWebSearch({
  query,
  timeoutMs,
  maxResults
}: WebSearchOptions): Promise<ProviderResponse> {
  const startedAt = Date.now();
  const apiKey = process.env.TAVILY_API_KEY ?? "";
  const searchDepth = getSearchDepth();
  const model = `tavily-${searchDepth}`;

  if (!apiKey) {
    return missingProviderConfig("web-search", ["TAVILY_API_KEY"], startedAt, model);
  }

  const cleanQuery = cleanSearchQuery(query);
  const searchQuery = buildCurrentSearchQuery(cleanQuery);

  if (!searchQuery) {
    return {
      provider: "web-search",
      model,
      ok: false,
      skipped: true,
      error: "Missing search query",
      latencyMs: Date.now() - startedAt
    };
  }

  try {
    const data = await fetchJsonWithTimeout<TavilySearchResponse>(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: searchQuery,
          search_depth: searchDepth,
          include_answer: false,
          include_raw_content: false,
          include_images: false,
          max_results: getMaxResults(maxResults),
          topic: "general"
        })
      },
      timeoutMs ?? getTimeoutMs(process.env.AION_LIVE_VERIFICATION_TIMEOUT_MS, 35000)
    );

    const sources = normalizeTavilyResults(data.results ?? []);

    if (sources.length === 0) {
      throw new Error("Search returned no source results");
    }

    return {
      provider: "web-search",
      model,
      ok: true,
      content: formatSearchContext(data.query || searchQuery, sources),
      webSources: sources.map(({ title, url }) => ({ title, url })),
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return providerFailure("web-search", error, startedAt, model);
  }
}

function cleanSearchQuery(query: string) {
  return query
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCurrentSearchQuery(query: string) {
  const currentSuffix = ` current as of ${new Date().toISOString().slice(0, 10)}`;
  const maxBaseLength = TAVILY_MAX_QUERY_LENGTH - currentSuffix.length;
  const baseQuery = query.slice(0, Math.max(0, maxBaseLength)).trim();

  return baseQuery ? `${baseQuery}${currentSuffix}` : "";
}

function getSearchDepth() {
  const configured = (process.env.TAVILY_SEARCH_DEPTH || DEFAULT_SEARCH_DEPTH).trim();
  return SEARCH_DEPTHS.has(configured) ? configured : DEFAULT_SEARCH_DEPTH;
}

function getMaxResults(value: number | undefined) {
  const configured = Number(process.env.TAVILY_MAX_RESULTS);
  const requested = value ?? (Number.isFinite(configured) ? configured : DEFAULT_MAX_RESULTS);
  return Math.min(Math.max(Math.floor(requested), 1), 10);
}

function normalizeTavilyResults(results: TavilyResult[]) {
  const seen = new Set<string>();
  const sources: SearchContextSource[] = [];

  for (const result of results) {
    const url = result.url?.trim();

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    sources.push({
      title: result.title?.trim() || getSourceLabel(url),
      url,
      snippet: result.content?.replace(/\s+/g, " ").trim(),
      publishedDate: result.published_date?.trim()
    });
  }

  return sources;
}

function formatSearchContext(query: string, sources: SearchContextSource[]) {
  return [
    `Search query: ${query}`,
    "",
    "Search results supplied to the selected research model:",
    ...sources.map((source, index) =>
      [
        `${index + 1}. ${source.title}`,
        `   URL: ${source.url}`,
        source.publishedDate ? `   Published/updated: ${source.publishedDate}` : "",
        source.snippet ? `   Snippet: ${truncate(source.snippet, 420)}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    )
  ].join("\n");
}

function getSourceLabel(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "Source";
  }
}
