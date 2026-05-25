import { NextResponse } from "next/server";
import { createVideoJob } from "@/services/serverMemory";
import type { VideoStyle } from "@/types/workspace";

type VideoGenerateBody = {
  prompt?: unknown;
  style?: unknown;
  duration?: unknown;
};

const styles = new Set<VideoStyle>(["cinematic", "animated", "realistic", "abstract"]);
const durations = new Set([4, 8, 16]);

export async function POST(request: Request) {
  let body: VideoGenerateBody;

  try {
    body = (await request.json()) as VideoGenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1000) : "";
  const style = styles.has(body.style as VideoStyle) ? (body.style as VideoStyle) : "cinematic";
  const duration = durations.has(Number(body.duration)) ? Number(body.duration) : 4;

  if (prompt.length < 2) {
    return NextResponse.json({ error: "Prompt must be at least 2 characters." }, { status: 400 });
  }

  const job = createVideoJob(prompt, style, duration);

  return NextResponse.json({ ...job, jobId: job.id }, { status: 202 });
}
