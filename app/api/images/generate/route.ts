import { NextResponse } from "next/server";
import {
  fetchJsonWithTimeout,
  getTimeoutMs,
  ProviderHttpError,
  truncate
} from "@/providers/providerUtils";
import { getCurrentUser } from "@/services/auth";
import { saveGeneratedImage } from "@/services/serverMemory";
import type {
  ImageAspectRatio,
  ImageModelKey,
  ImageProvider,
  ImageQuality,
  StoredGeneratedImage
} from "@/types/workspace";

export const runtime = "nodejs";

const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const RUNWARE_IMAGE_ENDPOINT = "https://api.runware.ai/v1";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1";
const DEFAULT_RUNWARE_IMAGE_MODEL = "runware:100@1";
const DEFAULT_RUNWARE_PRO_IMAGE_MODEL = "runware:400@1";
const MAX_IMAGE_PROMPT_LENGTH = 32000;
const OPENAI_IMAGE_SIZES = {
  square: "1024x1024",
  portrait: "1024x1536",
  landscape: "1536x1024"
} satisfies Record<ImageAspectRatio, string>;
const RUNWARE_IMAGE_SIZES = {
  square: { width: 1024, height: 1024 },
  portrait: { width: 768, height: 1344 },
  landscape: { width: 1344, height: 768 }
} satisfies Record<ImageAspectRatio, { width: number; height: number }>;
const IMAGE_QUALITIES = new Set<ImageQuality>(["auto", "low", "medium", "high"]);

type ImageGenerateBody = {
  prompt?: unknown;
  provider?: unknown;
  modelKey?: unknown;
  aspectRatio?: unknown;
  quality?: unknown;
};

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
};

type RunwareTaskResponse = {
  taskType?: string;
  taskUUID?: string;
  imageUUID?: string;
  imageURL?: string;
  imageBase64Data?: string;
  imageDataURI?: string;
  error?: string;
  message?: string;
};

type RunwareImageResponse =
  | RunwareTaskResponse[]
  | {
      data?: RunwareTaskResponse[];
      errors?: Array<{ message?: string }>;
      error?: { message?: string } | string;
      message?: string;
    };

type GenerateImageInput = {
  prompt: string;
  provider: ImageProvider;
  modelKey: ImageModelKey;
  aspectRatio: ImageAspectRatio;
  quality: ImageQuality;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: ImageGenerateBody;

  try {
    body = (await request.json()) as ImageGenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input: GenerateImageInput = {
    prompt: typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_IMAGE_PROMPT_LENGTH) : "",
    provider: normalizeProvider(body.provider),
    modelKey: normalizeModelKey(body.modelKey),
    aspectRatio: normalizeAspectRatio(body.aspectRatio),
    quality: normalizeQuality(body.quality)
  };

  if (input.prompt.length < 2) {
    return NextResponse.json({ error: "Prompt must be at least 2 characters." }, { status: 400 });
  }

  try {
    const image =
      input.provider === "runware" ? await generateRunwareImage(input) : await generateOpenAIImage(input);

    return NextResponse.json({ image: saveGeneratedImage(image) }, { status: 201 });
  } catch (error) {
    const status = error instanceof ProviderHttpError ? error.status : 500;
    const message = getImageErrorMessage(error);

    return NextResponse.json({ error: message }, { status });
  }
}

async function generateOpenAIImage(input: GenerateImageInput): Promise<StoredGeneratedImage> {
  const apiKey = process.env.OPENAI_API_KEY ?? "";

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const model = getOpenAIImageModel(input.modelKey);
  const size = OPENAI_IMAGE_SIZES[input.aspectRatio];
  const timeoutMs = getTimeoutMs(process.env.AION_IMAGE_TIMEOUT_MS, 60000);
  const data = await fetchJsonWithTimeout<OpenAIImageResponse>(
    OPENAI_IMAGE_ENDPOINT,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        size,
        quality: input.quality,
        n: 1
      })
    },
    timeoutMs
  );

  const generated = data.data?.[0];
  const base64 = cleanString(generated?.b64_json);
  const sourceUrl = cleanString(generated?.url);

  if (!base64 && !sourceUrl) {
    throw new Error("OpenAI image generation returned no image.");
  }

  const id = crypto.randomUUID();

  return {
    id,
    provider: "openai",
    modelKey: input.modelKey,
    prompt: input.prompt,
    model,
    aspectRatio: input.aspectRatio,
    size,
    quality: input.quality,
    url: sourceUrl || `/api/images/${id}`,
    revisedPrompt: cleanString(generated?.revised_prompt) || undefined,
    mimeType: "image/png",
    base64: base64 || undefined,
    sourceUrl: sourceUrl || undefined,
    createdAt: Date.now()
  };
}

async function generateRunwareImage(input: GenerateImageInput): Promise<StoredGeneratedImage> {
  const apiKey = process.env.RUNWARE_API_KEY ?? "";

  if (!apiKey) {
    throw new Error("Missing RUNWARE_API_KEY.");
  }

  const model = getRunwareImageModel(input.modelKey);
  const dimensions = RUNWARE_IMAGE_SIZES[input.aspectRatio];
  const size = `${dimensions.width}x${dimensions.height}`;
  const timeoutMs = getTimeoutMs(process.env.RUNWARE_IMAGE_TIMEOUT_MS, 60000);
  const taskUUID = crypto.randomUUID();
  const data = await fetchJsonWithTimeout<RunwareImageResponse>(
    RUNWARE_IMAGE_ENDPOINT,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([
        {
          taskType: "imageInference",
          taskUUID,
          positivePrompt: input.prompt,
          model,
          width: dimensions.width,
          height: dimensions.height,
          outputType: "URL",
          outputFormat: "PNG",
          outputQuality: getRunwareOutputQuality(input.quality),
          numberResults: 1
        }
      ])
    },
    timeoutMs
  );

  const generated = getRunwareImageResult(data);
  const sourceUrl = cleanString(generated?.imageURL);
  const base64 = cleanString(generated?.imageBase64Data) || getBase64FromDataUri(generated?.imageDataURI);
  const dataUri = cleanString(generated?.imageDataURI);

  if (!sourceUrl && !base64 && !dataUri) {
    throw new Error(getRunwareResponseError(data) || "Runware image generation returned no image.");
  }

  const id = crypto.randomUUID();

  return {
    id,
    provider: "runware",
    modelKey: input.modelKey,
    prompt: input.prompt,
    model,
    aspectRatio: input.aspectRatio,
    size,
    quality: input.quality,
    url: dataUri || sourceUrl || `/api/images/${id}`,
    mimeType: getMimeTypeFromDataUri(dataUri) || "image/png",
    base64: base64 || undefined,
    sourceUrl: sourceUrl || undefined,
    createdAt: Date.now()
  };
}

function normalizeProvider(value: unknown): ImageProvider {
  return value === "runware" || value === "openai" ? value : "openai";
}

function normalizeModelKey(value: unknown): ImageModelKey {
  return value === "pro" || value === "default" ? value : "default";
}

function normalizeAspectRatio(value: unknown): ImageAspectRatio {
  return value === "portrait" || value === "landscape" || value === "square" ? value : "square";
}

function normalizeQuality(value: unknown): ImageQuality {
  return typeof value === "string" && IMAGE_QUALITIES.has(value as ImageQuality)
    ? (value as ImageQuality)
    : "auto";
}

function getOpenAIImageModel(modelKey: ImageModelKey) {
  const openAIModels = parseModelList(process.env.OPENAI_IMAGE_MODEL);

  if (modelKey === "pro") {
    return (
      process.env.OPENAI_IMAGE_MODEL_PRO?.trim() ||
      openAIModels[1] ||
      openAIModels[0] ||
      DEFAULT_OPENAI_IMAGE_MODEL
    );
  }

  return openAIModels[0] || DEFAULT_OPENAI_IMAGE_MODEL;
}

function getRunwareImageModel(modelKey: ImageModelKey) {
  if (modelKey === "pro") {
    return (
      process.env.RUNWARE_IMAGE_MODEL_PRO?.trim() ||
      process.env.RUNWARE_IMAGE_MODEL?.trim() ||
      DEFAULT_RUNWARE_PRO_IMAGE_MODEL
    );
  }

  return (
    process.env.RUNWARE_IMAGE_MODEL_DEFAULT?.trim() ||
    process.env.RUNWARE_IMAGE_MODEL?.trim() ||
    DEFAULT_RUNWARE_IMAGE_MODEL
  );
}

function getRunwareOutputQuality(quality: ImageQuality) {
  switch (quality) {
    case "low":
      return 75;
    case "medium":
      return 90;
    case "high":
    case "auto":
      return 95;
  }
}

function getRunwareImageResult(data: RunwareImageResponse) {
  const responses = Array.isArray(data) ? data : data.data ?? [];

  return responses.find(
    (item) => Boolean(item.imageURL || item.imageBase64Data || item.imageDataURI)
  );
}

function getRunwareResponseError(data: RunwareImageResponse) {
  if (Array.isArray(data)) {
    return cleanString(data.find((item) => item.error || item.message)?.error) ||
      cleanString(data.find((item) => item.error || item.message)?.message);
  }

  if (typeof data.error === "string") {
    return data.error;
  }

  return (
    cleanString(data.error?.message) ||
    cleanString(data.errors?.find((error) => error.message)?.message) ||
    cleanString(data.message)
  );
}

function getImageErrorMessage(error: unknown) {
  if (error instanceof ProviderHttpError) {
    const bodyMessage = parseProviderError(error.body);
    return truncate(bodyMessage || error.message, 260);
  }

  if (error instanceof Error) {
    return truncate(error.name === "AbortError" ? "Image generation timed out." : error.message, 260);
  }

  return "Image generation failed.";
}

function parseProviderError(body: string) {
  try {
    const parsed = JSON.parse(body) as OpenAIImageResponse | RunwareImageResponse;

    if (Array.isArray(parsed)) {
      return getRunwareResponseError(parsed);
    }

    return parsed.error && typeof parsed.error !== "string"
      ? parsed.error.message
      : typeof parsed.error === "string"
        ? parsed.error
        : getRunwareResponseError(parsed as RunwareImageResponse);
  } catch {
    return "";
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseModelList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getBase64FromDataUri(value: unknown) {
  const dataUri = cleanString(value);
  const match = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(dataUri);

  return match?.[1]?.trim() ?? "";
}

function getMimeTypeFromDataUri(value: unknown) {
  const dataUri = cleanString(value);
  const match = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(dataUri);

  return match?.[1]?.trim();
}
