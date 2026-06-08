"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Film, Loader2 } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { useVideoStore } from "@/store/useVideoStore";
import type { VideoJob, VideoStyle } from "@/types/workspace";

const styles: VideoStyle[] = ["cinematic", "animated", "realistic", "abstract"];
const durations = [4, 8, 16];

export function VideosHubContent() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<VideoStyle>("cinematic");
  const [duration, setDuration] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const jobs = useVideoStore((state) => state.jobs);
  const createJob = useVideoStore((state) => state.createJob);
  const updateJob = useVideoStore((state) => state.updateJob);
  const sortedJobs = useMemo(() => [...jobs].sort((left, right) => right.createdAt - left.createdAt), [jobs]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (prompt.trim().length < 2 || isGenerating) {
      return;
    }

    setIsGenerating(true);

    try {
      const id = await createJob({ prompt, style, duration });
      await pollVideo(id, updateJob);
      router.push(`/videos/${id}`);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <AppFrame title="Videos">
      <section className="route-content">
        <div className="video-hero">
          <Film size={26} />
          <h2>Generate video with Arya Mind</h2>
          <p>Describe a scene, choose a style and duration, then generate a video session.</p>
          <form className="video-form" onSubmit={handleSubmit}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="A cinematic macro shot of emerald light moving through glass..."
            />
            <div className="chip-row">
              {styles.map((item) => (
                <button
                  className={item === style ? "is-active" : ""}
                  type="button"
                  key={item}
                  onClick={() => setStyle(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="chip-row">
              {durations.map((item) => (
                <button
                  className={item === duration ? "is-active" : ""}
                  type="button"
                  key={item}
                  onClick={() => setDuration(item)}
                >
                  {item}s
                </button>
              ))}
            </div>
            <button className="primary-button full" type="submit" disabled={!prompt.trim() || isGenerating}>
              {isGenerating ? <Loader2 className="spin" size={16} /> : null}
              Generate
            </button>
          </form>
        </div>
        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Past generations</p>
            <h2>Video sessions</h2>
          </div>
        </div>
        {sortedJobs.length === 0 ? (
          <div className="empty-panel">
            <h3>No video sessions yet</h3>
            <p>Your generated video sessions will appear here with thumbnails and status.</p>
          </div>
        ) : (
          <div className="artifact-grid">
            {sortedJobs.map((job) => (
              <VideoCard job={job} key={job.id} />
            ))}
          </div>
        )}
      </section>
    </AppFrame>
  );
}

function VideoCard({ job }: { job: VideoJob }) {
  return (
    <a className="artifact-card video-card" href={`/videos/${job.id}`}>
      {job.thumbnailUrl ? <img className="artifact-thumb" src={job.thumbnailUrl} alt="" /> : <div className="video-placeholder" />}
      <div className="artifact-card-body">
        <h3>{job.prompt.slice(0, 72)}</h3>
        <p>{job.style} · {job.duration}s · {job.status}</p>
      </div>
      <div className="artifact-meta">
        <span />
        <time>{formatDistanceToNow(job.createdAt, { addSuffix: true })}</time>
      </div>
    </a>
  );
}

async function pollVideo(id: string, updateJob: (id: string, patch: Partial<VideoJob>) => void) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 1200 : 3000));
    const response = await fetch(`/api/videos/${id}/status`);
    const job = (await response.json()) as VideoJob;

    if (response.ok) {
      updateJob(id, job);

      if (job.status === "succeeded" || job.status === "failed") {
        return;
      }
    }
  }
}
