"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  VideoGenerationMode,
  VideoJob,
  VideoJobStatus,
  VideoModelKey,
  VideoStyle
} from "@/types/workspace";

type CreateVideoInput = {
  prompt: string;
  style: VideoStyle;
  duration: number;
  mode?: VideoGenerationMode;
  modelKey?: VideoModelKey;
  inputImageData?: string;
};

type VideoState = {
  jobs: VideoJob[];
  createJob: (input: CreateVideoInput) => Promise<string>;
  updateJob: (id: string, patch: Partial<VideoJob>) => void;
  removeJob: (id: string) => void;
  updateNotes: (id: string, notes: string) => void;
};

export const useVideoStore = create<VideoState>()(
  persist(
    (set) => ({
      jobs: [],

      async createJob(input) {
        const response = await fetch("/api/videos/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        const data = (await response.json()) as Partial<VideoJob> & { jobId?: string; error?: string };

        if (!response.ok || !data.jobId) {
          throw new Error(data.error || "Could not start video generation.");
        }

        const timestamp = Date.now();
        const job: VideoJob = {
          id: data.jobId,
          provider: data.provider,
          mode: data.mode ?? input.mode ?? "text",
          modelKey: data.modelKey ?? input.modelKey ?? "default",
          model: data.model,
          taskUUID: data.taskUUID,
          prompt: data.prompt ?? input.prompt,
          style: data.style ?? input.style,
          duration: data.duration ?? input.duration,
          resolution: data.resolution,
          status: normalizeStatus(data.status),
          outputUrl: data.outputUrl,
          thumbnailUrl: data.thumbnailUrl,
          inputImageUrl: data.inputImageUrl,
          progress: data.progress,
          cost: data.cost,
          error: data.error,
          createdAt: data.createdAt ?? timestamp,
          updatedAt: data.updatedAt ?? timestamp
        };

        set((state) => ({ jobs: [job, ...state.jobs.filter((item) => item.id !== job.id)] }));
        return job.id;
      },

      updateJob(id, patch) {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === id ? { ...job, ...patch, updatedAt: Date.now() } : job
          )
        }));
      },

      removeJob(id) {
        set((state) => ({ jobs: state.jobs.filter((job) => job.id !== id) }));
      },

      updateNotes(id, notes) {
        set((state) => ({
          jobs: state.jobs.map((job) => (job.id === id ? { ...job, notes, updatedAt: Date.now() } : job))
        }));
      }
    }),
    {
      name: "aion-mind-videos",
      storage: createJSONStorage(() => localStorage)
    }
  )
);

function normalizeStatus(status: unknown): VideoJobStatus {
  return status === "queued" || status === "processing" || status === "succeeded" || status === "failed"
    ? status
    : "queued";
}
