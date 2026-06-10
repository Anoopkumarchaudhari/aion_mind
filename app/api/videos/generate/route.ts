import { NextResponse } from "next/server";
import { getCurrentUser } from "@/services/auth";
import { createVideoThumbnail, saveVideoJob } from "@/services/serverMemory";
import {
  getGoogleVideoErrorMessage,
  startGoogleVideo
} from "@/services/googleVideo";
import {
  getRunwareVideoErrorMessage,
  startRunwareVideo
} from "@/services/runwareVideo";
import type {
  VideoGenerationMode,
  VideoModelKey,
  VideoProvider,
  VideoStyle
} from "@/types/workspace";

export const runtime = "nodejs";

type VideoGenerateBody = {
  prompt?: unknown;
  provider?: unknown;
  style?: unknown;
  duration?: unknown;
  mode?: unknown;
  modelKey?: unknown;
  inputImageData?: unknown;
};

const styles = new Set<VideoStyle>(["cinematic", "animated", "realistic", "abstract"]);
const runwareDurations = new Set([5, 10]);
const googleDurations = new Set([4, 6, 8]);
const MAX_VIDEO_PROMPT_LENGTH = 2000;
const MAX_INPUT_IMAGE_DATA_URI_LENGTH = 8_000_000;

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: VideoGenerateBody;

  try {
    body = (await request.json()) as VideoGenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_VIDEO_PROMPT_LENGTH) : "";
  const provider = normalizeProvider(body.provider);
  const style = styles.has(body.style as VideoStyle) ? (body.style as VideoStyle) : "cinematic";
  const duration = normalizeDuration(body.duration, provider);
  const mode = normalizeMode(body.mode);
  const modelKey = normalizeModelKey(body.modelKey, provider);
  const inputImageData = cleanInputImageData(body.inputImageData);

  if (prompt.length < 2) {
    return NextResponse.json({ error: "Prompt must be at least 2 characters." }, { status: 400 });
  }

  if (mode === "image" && !inputImageData) {
    return NextResponse.json({ error: "Add a first-frame image for image-to-video." }, { status: 400 });
  }

  try {
    const started = provider === "google" ? await startGoogleVideo({
      prompt,
      style,
      duration,
      mode,
      modelKey,
      inputImageData
    }) : await startRunwareVideo({
      prompt,
      style,
      duration,
      mode,
      modelKey,
      inputImageData
    });
    const timestamp = Date.now();
    const job = saveVideoJob({
      id: crypto.randomUUID(),
      provider,
      mode,
      modelKey,
      model: started.model,
      taskUUID: started.taskUUID,
      prompt,
      style,
      duration,
      resolution: started.resolution,
      status: started.status === "succeeded" ? "succeeded" : "queued",
      progress: started.progress,
      outputUrl: started.videoUrl,
      thumbnailUrl: mode === "image" ? inputImageData : createVideoThumbnail(prompt, style),
      inputImageUrl: mode === "image" ? inputImageData : undefined,
      cost: started.cost,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    return NextResponse.json({ ...job, jobId: job.id }, { status: job.status === "succeeded" ? 201 : 202 });
  } catch (error) {
    return NextResponse.json(
      { error: provider === "google" ? getGoogleVideoErrorMessage(error) : getRunwareVideoErrorMessage(error) },
      { status: 500 }
    );
  }
}

function normalizeProvider(value: unknown): VideoProvider {
  return value === "google" || value === "runware" ? value : "runware";
}

function normalizeMode(value: unknown): VideoGenerationMode {
  return value === "image" ? "image" : "text";
}

function normalizeDuration(value: unknown, provider: VideoProvider) {
  const parsed = Number(value);

  if (provider === "google") {
    return googleDurations.has(parsed) ? parsed : 8;
  }

  return runwareDurations.has(parsed) ? parsed : 5;
}

function normalizeModelKey(value: unknown, provider: VideoProvider): VideoModelKey {
  if (provider === "google" && value === "lite") {
    return "lite";
  }

  return value === "pro" ? "pro" : "default";
}

function cleanInputImageData(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const dataUri = value.trim();

  if (!/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(dataUri)) {
    return undefined;
  }

  return dataUri.length <= MAX_INPUT_IMAGE_DATA_URI_LENGTH ? dataUri : undefined;
}
