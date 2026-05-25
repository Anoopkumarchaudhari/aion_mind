import type { ProviderName, ProviderResponse } from "@/services/types";

const DEFAULT_RETRY_STATUSES = [408, 429, 500, 502, 503, 504];
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 1000;
const DEFAULT_RETRY_MAX_MS = 8000;

type FetchRetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryStatuses?: number[];
};

export class ProviderHttpError extends Error {
  status: number;
  body: string;
  retryAfterMs?: number;

  constructor(status: number, body: string, retryAfterMs?: number) {
    super(`HTTP ${status}: ${truncate(body || "Request failed", 260)}`);
    this.name = "ProviderHttpError";
    this.status = status;
    this.body = body;
    this.retryAfterMs = retryAfterMs;
  }
}

export function getTimeoutMs(value: string | undefined, fallbackMs: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

export function missingProviderConfig(
  provider: ProviderName,
  missing: string[],
  startedAt: number,
  model?: string
): ProviderResponse {
  return {
    provider,
    model,
    ok: false,
    skipped: true,
    error: `Missing ${missing.join(", ")}`,
    latencyMs: Date.now() - startedAt
  };
}

export function providerFailure(
  provider: ProviderName,
  error: unknown,
  startedAt: number,
  model?: string
): ProviderResponse {
  let message = "Request failed";

  if (error instanceof ProviderHttpError && error.status === 429) {
    const retryHint = error.retryAfterMs
      ? ` Retry after ${Math.ceil(error.retryAfterMs / 1000)}s.`
      : "";
    message = `Rate limit reached (HTTP 429).${retryHint} ${truncate(error.body, 200)}`.trim();
  } else if (error instanceof Error) {
    message = error.name === "AbortError" ? "Request timed out" : error.message;
  }

  return {
    provider,
    model,
    ok: false,
    error: truncate(message, 260),
    latencyMs: Date.now() - startedAt
  };
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retryOptions?: FetchRetryOptions
): Promise<T> {
  const response = await fetchWithTimeout(url, init, timeoutMs, retryOptions);
  const text = await response.text();

  if (!response.ok) {
    throw new ProviderHttpError(
      response.status,
      text,
      parseRetryAfterMs(response.headers.get("retry-after"))
    );
  }

  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retryOptions: FetchRetryOptions = {}
): Promise<Response> {
  const maxRetries = getNumberSetting(
    retryOptions.maxRetries,
    process.env.AION_PROVIDER_MAX_RETRIES,
    DEFAULT_MAX_RETRIES
  );
  const baseDelayMs = getNumberSetting(
    retryOptions.baseDelayMs,
    process.env.AION_PROVIDER_RETRY_BASE_MS,
    DEFAULT_RETRY_BASE_MS
  );
  const maxDelayMs = getNumberSetting(
    retryOptions.maxDelayMs,
    process.env.AION_PROVIDER_RETRY_MAX_MS,
    DEFAULT_RETRY_MAX_MS
  );
  const retryStatuses = retryOptions.retryStatuses ?? DEFAULT_RETRY_STATUSES;
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (
        response.ok ||
        attempt >= maxRetries ||
        !retryStatuses.includes(response.status)
      ) {
        return response;
      }

      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      await discardResponseBody(response);
      await delay(getRetryDelayMs(attempt, baseDelayMs, maxDelayMs, retryAfterMs));
      attempt += 1;
    } catch (error) {
      clearTimeout(timeout);

      if (isAbortError(error) || attempt >= maxRetries) {
        throw error;
      }

      await delay(getRetryDelayMs(attempt, baseDelayMs, maxDelayMs));
      attempt += 1;
    }
  }
}

export function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export function compactContent(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumberSetting(
  value: number | undefined,
  envValue: string | undefined,
  fallback: number
): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getRetryDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  retryAfterMs?: number
) {
  if (retryAfterMs !== undefined) {
    return Math.min(retryAfterMs, maxDelayMs);
  }

  const exponentialDelay = baseDelayMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * Math.min(250, baseDelayMs));
  return Math.min(maxDelayMs, exponentialDelay + jitter);
}

function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : undefined;
}

async function discardResponseBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    return;
  }
}

function delay(ms: number) {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
