"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Download, RefreshCcw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AppFrame } from "@/components/AppFrame";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useVideoStore } from "@/store/useVideoStore";
import type { VideoJob } from "@/types/workspace";

type VideoSessionContentProps = {
  videoId: string;
};

export function VideoSessionContent({ videoId }: VideoSessionContentProps) {
  const jobs = useVideoStore((state) => state.jobs);
  const updateJob = useVideoStore((state) => state.updateJob);
  const updateNotes = useVideoStore((state) => state.updateNotes);
  const createJob = useVideoStore((state) => state.createJob);
  const addLibraryItem = useLibraryStore((state) => state.addItem);
  const job = jobs.find((item) => item.id === videoId);

  useEffect(() => {
    if (!job || job.status === "succeeded" || job.status === "failed") {
      return;
    }

    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/videos/${job.id}/status`);
      const next = (await response.json()) as VideoJob;

      if (response.ok) {
        updateJob(job.id, next);
      }
    }, 3000);

    return () => window.clearInterval(timer);
  }, [job, updateJob]);

  if (!job) {
    return (
      <AppFrame title="Video">
        <section className="route-content">
          <div className="empty-panel">
            <h3>Video session not found</h3>
            <Link className="primary-button" href="/videos">Back to videos</Link>
          </div>
        </section>
      </AppFrame>
    );
  }

  const currentJob = job;

  async function spawnVariant(suffix: string) {
    const id = await createJob({
      prompt: `${currentJob.prompt} ${suffix}`,
      style: currentJob.style,
      duration: currentJob.duration
    });

    window.location.href = `/videos/${id}`;
  }

  return (
    <AppFrame title="Video session">
      <section className="route-content video-session">
        <div className="video-player-card">
          {currentJob.outputUrl ? (
            <video controls poster={currentJob.thumbnailUrl} src={currentJob.outputUrl} />
          ) : (
            <div className="video-processing" style={{ backgroundImage: currentJob.thumbnailUrl ? `url("${currentJob.thumbnailUrl}")` : undefined }}>
              <span>{currentJob.status === "failed" ? "Generation failed" : "Generating video..."}</span>
            </div>
          )}
          <div className="video-player-actions">
            {currentJob.outputUrl ? (
              <a className="ghost-button" href={currentJob.outputUrl} download={`aion-video-${currentJob.id}.mp4`}>
                <Download size={15} />
                Download
              </a>
            ) : null}
            {currentJob.outputUrl ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  addLibraryItem({
                    type: "video",
                    title: currentJob.prompt.slice(0, 64) || "Generated video",
                    url: currentJob.thumbnailUrl || currentJob.outputUrl,
                    content: currentJob.prompt
                  });
                  toast.success("Video saved to Library");
                }}
              >
                Save
              </button>
            ) : null}
          </div>
        </div>
        <div className="video-detail-grid">
          <article className="detail-panel">
            <p className="eyebrow">Prompt</p>
            <h2>{currentJob.prompt}</h2>
            <p>{currentJob.style} - {currentJob.duration}s - {currentJob.status}</p>
            <div className="action-row">
              <button className="ghost-button" type="button" onClick={() => spawnVariant("with tighter pacing")}>
                <RefreshCcw size={15} />
                Regenerate
              </button>
              <button className="ghost-button" type="button" onClick={() => spawnVariant("as four visual variations")}>
                <Sparkles size={15} />
                Variations
              </button>
              <button className="ghost-button" type="button" onClick={() => spawnVariant("remixed with a new camera angle")}>
                <Wand2 size={15} />
                Remix
              </button>
            </div>
          </article>
          <article className="detail-panel">
            <p className="eyebrow">Comments</p>
            <textarea
              className="notes-area"
              value={currentJob.notes || ""}
              onChange={(event) => updateNotes(currentJob.id, event.target.value)}
              placeholder="Add production notes, edit ideas, or client feedback..."
            />
          </article>
        </div>
      </section>
    </AppFrame>
  );
}
