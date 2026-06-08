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
  ImageQuality,
  StoredGeneratedImage
} from "@/types/workspace";

export const runtime = "nodejs";

const DEFAULT_IMAGE_MODEL = "gpt-image-1";
const MAX_IMAGE_PROMPT_LENGTH = 32000;
const IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const IMAGE_SIZES = {
  square: "1024x1024",
  portrait: "1024x1536",
  landscape: "1536x1024"
} satisfies Record<ImageAspectRatio, string>;
const IMAGE_QUALITIES = new Set<ImageQuality>(["auto", "low", "medium", "high"]);

type ImageGenerateBody = {
  prompt?: unknown;
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

  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_IMAGE_PROMPT_LENGTH) : "";
  const aspectRatio = normalizeAspectRatio(body.aspectRatio);
  const quality = normalizeQuality(body.quality);

  if (prompt.length < 2) {
    return NextResponse.json({ error: "Prompt must be at least 2 characters." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";

  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 503 });
  }

  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const size = IMAGE_SIZES[aspectRatio];
  const timeoutMs = getTimeoutMs(process.env.AION_IMAGE_TIMEOUT_MS, 60000);

  try {
    const data = await fetchJsonWithTimeout<OpenAIImageResponse>(
      IMAGE_ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          prompt,
          size,
          quality,
          n: 1
        })
      },
      timeoutMs
    );

    const generated = data.data?.[0];
    const base64 = typeof generated?.b64_json === "string" ? generated.b64_json.trim() : "";
    const sourceUrl = typeof generated?.url === "string" ? generated.url.trim() : "";

    if (!base64 && !sourceUrl) {
      throw new Error("Image generation returned no image.");
    }

    const id = crypto.randomUUID();
    const image: StoredGeneratedImage = {
      id,
      prompt,
      model,
      aspectRatio,
      size,
      quality,
      url: sourceUrl || `/api/images/${id}`,
      revisedPrompt:
        typeof generated?.revised_prompt === "string" ? generated.revised_prompt.trim() : undefined,
      mimeType: "image/png",
      base64: base64 || undefined,
      sourceUrl: sourceUrl || undefined,
      createdAt: Date.now()
    };

    return NextResponse.json({ image: saveGeneratedImage(image) }, { status: 201 });
  } catch (error) {
    const status = error instanceof ProviderHttpError ? error.status : 500;
    const message = getImageErrorMessage(error);

    return NextResponse.json({ error: message }, { status });
  }
}

function normalizeAspectRatio(value: unknown): ImageAspectRatio {
  return value === "portrait" || value === "landscape" || value === "square" ? value : "square";
}

function normalizeQuality(value: unknown): ImageQuality {
  return typeof value === "string" && IMAGE_QUALITIES.has(value as ImageQuality)
    ? (value as ImageQuality)
    : "auto";
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
    const parsed = JSON.parse(body) as OpenAIImageResponse;
    return parsed.error?.message;
  } catch {
    return "";
  }
}
