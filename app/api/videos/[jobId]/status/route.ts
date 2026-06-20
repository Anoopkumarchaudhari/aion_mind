import { NextResponse } from "next/server";
import { ProviderHttpError } from "@/providers/providerUtils";
import { getCurrentUser } from "@/services/auth";
import { getVideoJob, patchVideoJob } from "@/services/serverMemory";
import {
  getGoogleVideoErrorMessage,
  pollGoogleVideo
} from "@/services/googleVideo";
import {
  getRunwareVideoErrorMessage,
  pollRunwareVideo
} from "@/services/runwareVideo";
import type { VideoJob } from "@/types/workspace";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { jobId } = await context.params;
  const job = await getVideoJob(user.id, jobId);

  if (!job) {
    return NextResponse.json({ error: "Video job not found" }, { status: 404 });
  }

  if (job.status === "succeeded" || job.status === "failed" || !job.taskUUID) {
    return NextResponse.json(job);
  }

  try {
    const result = job.provider === "google" ? await pollGoogleVideo(job.taskUUID) : await pollRunwareVideo(job.taskUUID);
    const patch: Partial<VideoJob> = {
      status: result.status,
      progress: result.progress,
      error: result.status === "failed" ? result.error : undefined
    };

    if (result.videoUrl) {
      patch.outputUrl = result.videoUrl;
    }

    if (result.cost !== undefined) {
      patch.cost = result.cost;
    }

    const next = (await patchVideoJob(user.id, job.id, patch)) ?? job;
    return NextResponse.json(next);
  } catch (error) {
    const message = job.provider === "google" ? getGoogleVideoErrorMessage(error) : getRunwareVideoErrorMessage(error);
    const shouldFail =
      error instanceof ProviderHttpError && [400, 401, 403, 404].includes(error.status);
    const next =
      (await patchVideoJob(user.id, job.id, {
        status: shouldFail ? "failed" : "processing",
        error: message
      })) ?? job;

    return NextResponse.json(next);
  }
}
