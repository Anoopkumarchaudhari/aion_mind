import {
  fetchJsonWithTimeout,
  fetchWithTimeout,
  getTimeoutMs,
  ProviderHttpError,
  truncate
} from "@/providers/providerUtils";
import type {
  VideoGenerationMode,
  VideoJobStatus,
  VideoModelKey,
  VideoStyle
} from "@/types/workspace";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_VIDEO_LITE_MODEL = "veo-3.1-fast-generate-preview";
const DEFAULT_GEMINI_VIDEO_FAST_MODEL = "veo-3.1-fast-generate-preview";
const DEFAULT_GEMINI_VIDEO_PRO_MODEL = "veo-3.1-generate-preview";
const DEFAULT_VIDEO_TIMEOUT_MS = 60000;
const DEFAULT_STATUS_TIMEOUT_MS = 45000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 90000;

type GoogleVideoOperation = {
  name?: string;
  done?: boolean;
  metadata?: {
    progressPercentage?: number;
  };
  error?: {
    message?: string;
    code?: number;
    status?: string;
  };
  response?: GoogleVideoOperationResponse;
};

type GoogleVideoOperationResponse = {
  generateVideoResponse?: {
    generatedSamples?: Array<{
      video?: GoogleVideoPayload;
    }>;
  };
  generatedVideos?: Array<{
    video?: GoogleVideoPayload;
  }>;
  videos?: GoogleVideoPayload[];
};

type GoogleVideoPayload = {
  uri?: string;
  bytesBase64Encoded?: string;
  mimeType?: string;
};

export type StartGoogleVideoInput = {
  prompt: string;
  style: VideoStyle;
  duration: number;
  mode: VideoGenerationMode;
  modelKey: VideoModelKey;
  inputImageData?: string;
};

export type GoogleVideoStatus = {
  taskUUID: string;
  model?: string;
  resolution?: string;
  status: VideoJobStatus;
  videoUrl?: string;
  progress?: number;
  cost?: number;
  error?: string;
};

export async function startGoogleVideo(input: StartGoogleVideoInput): Promise<GoogleVideoStatus> {
  const apiKey = process.env.GEMINI_API_KEY ?? "";

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const model = getGoogleVideoModel(input.modelKey);
  const timeoutMs = getTimeoutMs(process.env.GEMINI_VIDEO_TIMEOUT_MS, DEFAULT_VIDEO_TIMEOUT_MS);
  const operation = await fetchJsonWithTimeout<GoogleVideoOperation>(
    `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:predictLongRunning?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        instances: [buildGoogleVideoInstance(input)],
        parameters: {
          aspectRatio: "16:9",
          durationSeconds: normalizeGoogleDuration(input.duration),
          sampleCount: 1
        }
      })
    },
    timeoutMs
  );

  if (operation.error?.message) {
    throw new Error(operation.error.message);
  }

  if (!operation.name) {
    throw new Error("Google Veo did not return an operation name.");
  }

  return {
    taskUUID: operation.name,
    model,
    resolution: input.modelKey === "pro" ? "1080p" : "720p",
    status: operation.done ? "processing" : "queued",
    progress: operation.metadata?.progressPercentage
  };
}

export async function pollGoogleVideo(operationName: string): Promise<GoogleVideoStatus> {
  const apiKey = process.env.GEMINI_API_KEY ?? "";

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const timeoutMs = getTimeoutMs(
    process.env.GEMINI_VIDEO_STATUS_TIMEOUT_MS,
    DEFAULT_STATUS_TIMEOUT_MS
  );
  const operation = await fetchJsonWithTimeout<GoogleVideoOperation>(
    `${GEMINI_API_BASE}/${operationName}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "GET"
    },
    timeoutMs,
    { maxRetries: 0 }
  );

  if (operation.error?.message) {
    return {
      taskUUID: operationName,
      status: "failed",
      error: operation.error.message,
      progress: operation.metadata?.progressPercentage
    };
  }

  if (!operation.done) {
    return {
      taskUUID: operationName,
      status: "processing",
      progress: operation.metadata?.progressPercentage
    };
  }

  const video = getGoogleVideoPayload(operation.response);
  const videoUrl = await getGoogleVideoUrl(video, apiKey);

  if (!videoUrl) {
    return {
      taskUUID: operationName,
      status: "failed",
      error: "Google Veo completed without returning a video.",
      progress: 100
    };
  }

  return {
    taskUUID: operationName,
    status: "succeeded",
    videoUrl,
    progress: 100
  };
}

export function getGoogleVideoErrorMessage(error: unknown) {
  if (error instanceof ProviderHttpError) {
    const bodyMessage = parseProviderError(error.body);
    return truncate(bodyMessage || error.message, 260);
  }

  if (error instanceof Error) {
    return truncate(error.name === "AbortError" ? "Google Veo request timed out." : error.message, 260);
  }

  return "Google Veo generation failed.";
}

function buildGoogleVideoInstance(input: StartGoogleVideoInput) {
  const instance: Record<string, unknown> = {
    prompt: buildStyledPrompt(input.prompt, input.style)
  };
  const image = parseImageDataUri(input.inputImageData);

  if (input.mode === "image" && image) {
    instance.image = {
      bytesBase64Encoded: image.base64,
      mimeType: image.mimeType
    };
  }

  return instance;
}

function getGoogleVideoModel(modelKey: VideoModelKey) {
  switch (modelKey) {
    case "lite":
      return (
        process.env.GEMINI_VIDEO_MODEL_LITE?.trim() ||
        process.env.GEMINI_VIDEO_MODEL?.trim() ||
        DEFAULT_GEMINI_VIDEO_LITE_MODEL
      );
    case "pro":
      return (
        process.env.GEMINI_VIDEO_MODEL_PRO?.trim() ||
        process.env.GEMINI_VIDEO_MODEL?.trim() ||
        DEFAULT_GEMINI_VIDEO_PRO_MODEL
      );
    case "default":
    default:
      return (
        process.env.GEMINI_VIDEO_MODEL_FAST?.trim() ||
        process.env.GEMINI_VIDEO_MODEL?.trim() ||
        DEFAULT_GEMINI_VIDEO_FAST_MODEL
      );
  }
}

function normalizeGoogleDuration(duration: number) {
  return [4, 6, 8].includes(duration) ? duration : 8;
}

function buildStyledPrompt(prompt: string, style: VideoStyle) {
  const stylePrompts = {
    cinematic:
      "cinematic camera movement, filmic lighting, strong depth, natural motion, polished color grade",
    animated:
      "expressive animated motion, clean silhouettes, playful timing, rich color, clear character action",
    realistic:
      "realistic textures, natural lighting, believable physics, documentary camera movement, lifelike motion",
    abstract:
      "abstract visual rhythm, surreal transitions, expressive shapes, luminous atmosphere, fluid motion"
  } satisfies Record<VideoStyle, string>;

  return `${prompt}\n\nStyle direction: ${stylePrompts[style]}`;
}

function getGoogleVideoPayload(response: GoogleVideoOperationResponse | undefined) {
  return (
    response?.generateVideoResponse?.generatedSamples?.find((sample) => sample.video)?.video ??
    response?.generatedVideos?.find((sample) => sample.video)?.video ??
    response?.videos?.find((video) => Boolean(video.uri || video.bytesBase64Encoded))
  );
}

async function getGoogleVideoUrl(video: GoogleVideoPayload | undefined, apiKey: string) {
  const base64 = cleanString(video?.bytesBase64Encoded);

  if (base64) {
    return `data:${cleanString(video?.mimeType) || "video/mp4"};base64,${base64}`;
  }

  const uri = cleanString(video?.uri);

  if (!uri) {
    return "";
  }

  return downloadGoogleVideo(uri, apiKey);
}

async function downloadGoogleVideo(uri: string, apiKey: string) {
  const timeoutMs = getTimeoutMs(
    process.env.GEMINI_VIDEO_DOWNLOAD_TIMEOUT_MS,
    DEFAULT_DOWNLOAD_TIMEOUT_MS
  );
  const separator = uri.includes("?") ? "&" : "?";
  const response = await fetchWithTimeout(
    `${uri}${separator}key=${encodeURIComponent(apiKey)}`,
    {
      method: "GET"
    },
    timeoutMs,
    { maxRetries: 1 }
  );
  const body = await response.arrayBuffer();

  if (!response.ok) {
    throw new ProviderHttpError(response.status, Buffer.from(body).toString("utf8"));
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
  return `data:${mimeType};base64,${Buffer.from(body).toString("base64")}`;
}

function parseImageDataUri(value: string | undefined) {
  const dataUri = cleanString(value);
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,([a-z0-9+/=\s]+)$/i.exec(dataUri);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64: match[2].replace(/\s+/g, "")
  };
}

function parseProviderError(body: string) {
  try {
    const parsed = JSON.parse(body) as GoogleVideoOperation;
    return parsed.error?.message || "";
  } catch {
    return "";
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
