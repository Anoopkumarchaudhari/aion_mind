import {
  fetchJsonWithTimeout,
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

const RUNWARE_VIDEO_ENDPOINT = "https://api.runware.ai/v1";
const DEFAULT_RUNWARE_VIDEO_MODEL = "prunaai:p-video@0";
const DEFAULT_RUNWARE_PRO_VIDEO_MODEL = "klingai:kling-video@3-pro";
const DEFAULT_VIDEO_TIMEOUT_MS = 60000;
const DEFAULT_STATUS_TIMEOUT_MS = 30000;

type RunwareVideoTaskResponse = {
  taskType?: string;
  taskUUID?: string;
  status?: string;
  progress?: number;
  videoUUID?: string;
  videoURL?: string;
  videoBase64Data?: string;
  videoDataURI?: string;
  cost?: number;
  error?: string;
  message?: string;
};

type RunwareVideoResponse =
  | RunwareVideoTaskResponse[]
  | {
      data?: RunwareVideoTaskResponse[];
      errors?: Array<{ message?: string; code?: string; status?: string; taskUUID?: string }>;
      error?: { message?: string } | string;
      message?: string;
    };

export type StartRunwareVideoInput = {
  prompt: string;
  style: VideoStyle;
  duration: number;
  mode: VideoGenerationMode;
  modelKey: VideoModelKey;
  inputImageData?: string;
};

export type RunwareVideoStatus = {
  taskUUID: string;
  model?: string;
  resolution?: string;
  status: VideoJobStatus;
  videoUrl?: string;
  progress?: number;
  cost?: number;
  error?: string;
};

export async function startRunwareVideo(input: StartRunwareVideoInput): Promise<RunwareVideoStatus> {
  const apiKey = process.env.RUNWARE_API_KEY ?? "";

  if (!apiKey) {
    throw new Error("Missing RUNWARE_API_KEY.");
  }

  const model = getRunwareVideoModel(input.modelKey);
  const taskUUID = crypto.randomUUID();
  const task = buildRunwareVideoTask(input, taskUUID, model);
  const timeoutMs = getTimeoutMs(process.env.RUNWARE_VIDEO_TIMEOUT_MS, DEFAULT_VIDEO_TIMEOUT_MS);
  const data = await fetchJsonWithTimeout<RunwareVideoResponse>(
    RUNWARE_VIDEO_ENDPOINT,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([task])
    },
    timeoutMs
  );

  const result = toRunwareVideoStatus(data, taskUUID);

  if (result.status === "failed") {
    throw new Error(result.error || "Runware video generation failed.");
  }

  return {
    ...result,
    taskUUID,
    model,
    resolution: getTaskResolution(task, model)
  };
}

export async function pollRunwareVideo(taskUUID: string): Promise<RunwareVideoStatus> {
  const apiKey = process.env.RUNWARE_API_KEY ?? "";

  if (!apiKey) {
    throw new Error("Missing RUNWARE_API_KEY.");
  }

  const timeoutMs = getTimeoutMs(
    process.env.RUNWARE_VIDEO_STATUS_TIMEOUT_MS,
    DEFAULT_STATUS_TIMEOUT_MS
  );
  const data = await fetchJsonWithTimeout<RunwareVideoResponse>(
    RUNWARE_VIDEO_ENDPOINT,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([{ taskType: "getResponse", taskUUID }])
    },
    timeoutMs,
    { maxRetries: 0 }
  );

  return toRunwareVideoStatus(data, taskUUID);
}

export function getRunwareVideoErrorMessage(error: unknown) {
  if (error instanceof ProviderHttpError) {
    const bodyMessage = parseProviderError(error.body);
    return truncate(bodyMessage || error.message, 260);
  }

  if (error instanceof Error) {
    return truncate(error.name === "AbortError" ? "Video generation timed out." : error.message, 260);
  }

  return "Video generation failed.";
}

function buildRunwareVideoTask(
  input: StartRunwareVideoInput,
  taskUUID: string,
  model: string
): Record<string, unknown> {
  const task: Record<string, unknown> = {
    taskType: "videoInference",
    taskUUID,
    deliveryMethod: "async",
    includeCost: true,
    model,
    positivePrompt: buildStyledPrompt(input.prompt, input.style),
    duration: input.duration,
    outputType: "URL",
    outputFormat: "MP4",
    outputQuality: 95,
    numberResults: 1
  };

  if (input.mode === "image" && input.inputImageData) {
    task.inputs = {
      frameImages: [{ image: input.inputImageData, frame: "first" }]
    };

    if (isPVideoModel(model)) {
      task.resolution = "720p";
    }
  } else if (isKlingModel(model)) {
    task.width = 1920;
    task.height = 1080;
  } else {
    task.width = 1280;
    task.height = 720;
  }

  if (isPVideoModel(model)) {
    task.settings = {
      audio: false,
      draft: input.modelKey === "default",
      promptUpsampling: true
    };
  }

  return task;
}

function getRunwareVideoModel(modelKey: VideoModelKey) {
  if (modelKey === "pro") {
    return (
      process.env.RUNWARE_VIDEO_MODEL_PRO?.trim() ||
      process.env.RUNWARE_VIDEO_MODEL?.trim() ||
      DEFAULT_RUNWARE_PRO_VIDEO_MODEL
    );
  }

  return (
    process.env.RUNWARE_VIDEO_MODEL_DEFAULT?.trim() ||
    process.env.RUNWARE_VIDEO_MODEL?.trim() ||
    DEFAULT_RUNWARE_VIDEO_MODEL
  );
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

function toRunwareVideoStatus(data: RunwareVideoResponse, taskUUID: string): RunwareVideoStatus {
  const error = getRunwareResponseError(data, taskUUID);

  if (error) {
    return {
      taskUUID,
      status: "failed",
      error
    };
  }

  const responses = getRunwareResponses(data);
  const result =
    responses.find((item) => Boolean(getRunwareVideoUrl(item))) ??
    responses.find((item) => item.taskUUID === taskUUID) ??
    responses[0];

  const videoUrl = getRunwareVideoUrl(result);

  if (videoUrl) {
    return {
      taskUUID,
      status: "succeeded",
      videoUrl,
      progress: 100,
      cost: toNumber(result?.cost)
    };
  }

  if (result?.status === "error") {
    return {
      taskUUID,
      status: "failed",
      error: cleanString(result.message) || cleanString(result.error) || "Runware video generation failed."
    };
  }

  return {
    taskUUID,
    status: result?.status === "success" ? "succeeded" : "processing",
    progress: toNumber(result?.progress),
    cost: toNumber(result?.cost)
  };
}

function getRunwareResponses(data: RunwareVideoResponse) {
  return Array.isArray(data) ? data : data.data ?? [];
}

function getRunwareResponseError(data: RunwareVideoResponse, taskUUID: string) {
  if (Array.isArray(data)) {
    const item = data.find((response) => response.taskUUID === taskUUID && (response.error || response.message));
    return cleanString(item?.error) || cleanString(item?.message);
  }

  if (typeof data.error === "string") {
    return data.error;
  }

  return (
    cleanString(data.error?.message) ||
    cleanString(data.errors?.find((item) => !item.taskUUID || item.taskUUID === taskUUID)?.message) ||
    cleanString(data.message)
  );
}

function parseProviderError(body: string) {
  try {
    const parsed = JSON.parse(body) as RunwareVideoResponse;
    return getRunwareResponseError(parsed, "");
  } catch {
    return "";
  }
}

function getRunwareVideoUrl(result: RunwareVideoTaskResponse | undefined) {
  return (
    cleanString(result?.videoURL) ||
    cleanString(result?.videoDataURI) ||
    getVideoDataUriFromBase64(result?.videoBase64Data)
  );
}

function getVideoDataUriFromBase64(value: unknown) {
  const base64 = cleanString(value);
  return base64 ? `data:video/mp4;base64,${base64}` : "";
}

function getTaskResolution(task: Record<string, unknown>, model: string) {
  if (typeof task.resolution === "string") {
    return task.resolution;
  }

  const width = typeof task.width === "number" ? task.width : undefined;
  const height = typeof task.height === "number" ? task.height : undefined;

  if (width && height) {
    return `${width}x${height}`;
  }

  return isKlingModel(model) ? "source aspect" : "720p";
}

function isPVideoModel(model: string) {
  return model.toLowerCase().startsWith("prunaai:p-video");
}

function isKlingModel(model: string) {
  return model.toLowerCase().startsWith("klingai:");
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
