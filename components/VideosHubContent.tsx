"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Film, ImagePlus, Loader2, X } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { getAvailableCredits, getVideoCreditCharge, useBillingStore } from "@/store/useBillingStore";
import { useVideoStore } from "@/store/useVideoStore";
import type {
  VideoGenerationMode,
  VideoJob,
  VideoModelKey,
  VideoProvider,
  VideoStyle
} from "@/types/workspace";

const styles: Array<{ value: VideoStyle; label: string }> = [
  { value: "cinematic", label: "Cinematic" },
  { value: "animated", label: "Animated" },
  { value: "realistic", label: "Realistic" },
  { value: "abstract", label: "Abstract" }
];
const providerDurations: Record<VideoProvider, number[]> = {
  runware: [5, 10],
  google: [4, 6, 8]
};
const providers: Array<{ value: VideoProvider; label: string }> = [
  { value: "runware", label: "Runware" },
  { value: "google", label: "Google Veo" }
];
const modes: Array<{ value: VideoGenerationMode; label: string }> = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" }
];
const providerModels: Record<VideoProvider, Array<{ value: VideoModelKey; label: string }>> = {
  runware: [
    { value: "default", label: "prunaai:p-video@0" },
    { value: "pro", label: "klingai:kling-video@3-pro" }
  ],
  google: [
    { value: "lite", label: "veo-3.1-fast-generate-preview (lite)" },
    { value: "default", label: "veo-3.1-fast-generate-preview" },
    { value: "pro", label: "veo-3.1-generate-preview" }
  ]
};
const MAX_INPUT_IMAGE_BYTES = 8 * 1024 * 1024;

export function VideosHubContent() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<VideoProvider>("runware");
  const [style, setStyle] = useState<VideoStyle>("cinematic");
  const [duration, setDuration] = useState(5);
  const [mode, setMode] = useState<VideoGenerationMode>("text");
  const [modelKey, setModelKey] = useState<VideoModelKey>("default");
  const [inputImageData, setInputImageData] = useState("");
  const [inputImageName, setInputImageName] = useState("");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const jobs = useVideoStore((state) => state.jobs);
  const createJob = useVideoStore((state) => state.createJob);
  const updateJob = useVideoStore((state) => state.updateJob);
  const sortedJobs = useMemo(() => [...jobs].sort((left, right) => right.createdAt - left.createdAt), [jobs]);
  const modelOptions = providerModels[provider];
  const durationOptions = providerDurations[provider];
  const canGenerate = prompt.trim().length >= 2 && !isGenerating && (mode === "text" || Boolean(inputImageData));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!canGenerate) {
      if (mode === "image" && !inputImageData) {
        setError("Add a first-frame image before generating.");
      }

      return;
    }

    const creditCharge = getVideoCreditCharge(provider, modelKey, duration, mode);
    const billingState = useBillingStore.getState();

    if (getAvailableCredits(billingState) < creditCharge.credits) {
      setError(`Need ${creditCharge.credits} credits for ${creditCharge.label}.`);
      return;
    }

    billingState.spendCredits(creditCharge);
    setIsGenerating(true);
    setError("");

    try {
      const id = await createJob({
        prompt,
        provider,
        style,
        duration,
        mode,
        modelKey,
        inputImageData: mode === "image" ? inputImageData : undefined
      });
      await pollVideo(id, updateJob);
      router.push(`/videos/${id}`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Could not start video generation.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }

    if (file.size > MAX_INPUT_IMAGE_BYTES) {
      setError("Choose an image under 8 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setInputImageData(reader.result);
        setInputImageName(file.name);
        setError("");
      }
    };
    reader.onerror = () => setError("Could not read the image file.");
    reader.readAsDataURL(file);
  }

  function clearInputImage() {
    setInputImageData("");
    setInputImageName("");
  }

  return (
    <AppFrame title="Videos">
      <section className="route-content">
        <div className="video-hero">
          <Film size={26} />
          <h2>Generate video with Aria Mind</h2>
          <p>Describe a scene, choose a style and duration, then generate a video session.</p>
          <form className="video-form" onSubmit={handleSubmit}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="A cinematic tracking shot through a rain-glossed neon market at night..."
            />
            <div className="media-select-grid video-option-grid">
              <label className="media-select-field">
                <span>Provider</span>
                <select
                  value={provider}
                  onChange={(event) => {
                    const nextProvider = event.target.value as VideoProvider;
                    setProvider(nextProvider);
                    setModelKey("default");
                    setDuration(providerDurations[nextProvider][0] ?? 5);
                    setError("");
                  }}
                >
                  {providers.map((item) => (
                    <option value={item.value} key={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="media-select-field">
                <span>Sub model</span>
                <select value={modelKey} onChange={(event) => setModelKey(event.target.value as VideoModelKey)}>
                  {modelOptions.map((item) => (
                    <option value={item.value} key={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="media-select-field">
                <span>Input</span>
                <select
                  value={mode}
                  onChange={(event) => {
                    setMode(event.target.value as VideoGenerationMode);
                    setError("");
                  }}
                >
                  {modes.map((item) => (
                    <option value={item.value} key={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="media-select-field">
                <span>Style</span>
                <select value={style} onChange={(event) => setStyle(event.target.value as VideoStyle)}>
                  {styles.map((item) => (
                    <option value={item.value} key={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="media-select-field">
                <span>Duration</span>
                <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                  {durationOptions.map((item) => (
                    <option value={item} key={item}>
                      {item}s
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {mode === "image" ? (
              <div className="video-upload-panel">
                {inputImageData ? (
                  <div className="video-upload-preview">
                    <img src={inputImageData} alt="" />
                    <div>
                      <p>{inputImageName || "First frame image"}</p>
                      <button className="ghost-button" type="button" onClick={clearInputImage}>
                        <X size={15} />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="video-upload-target">
                    <ImagePlus size={18} />
                    <span>Add first frame image</span>
                    <input accept="image/png,image/jpeg,image/webp" type="file" onChange={handleImageChange} />
                  </label>
                )}
              </div>
            ) : null}
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button full" type="submit" disabled={!canGenerate}>
              {isGenerating ? <Loader2 className="spin" size={16} /> : null}
              {isGenerating ? "Starting..." : "Generate"}
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
        <p>{getVideoProviderLabel(job.provider)} - {job.mode ?? "text"} - {getVideoModelLabel(job)} - {job.duration}s - {job.status}</p>
      </div>
      <div className="artifact-meta">
        <span />
        <time>{formatDistanceToNow(job.createdAt, { addSuffix: true })}</time>
      </div>
    </a>
  );
}

function getVideoProviderLabel(provider: VideoProvider | undefined) {
  return provider === "google" ? "Google Veo" : "Runware";
}

function getVideoModelLabel(job: VideoJob) {
  if (job.model) {
    return job.model;
  }

  if (job.provider === "google") {
    switch (job.modelKey) {
      case "lite":
        return "veo-3.1-fast-generate-preview (lite)";
      case "pro":
        return "veo-3.1-generate-preview";
      case "default":
      default:
        return "veo-3.1-fast-generate-preview";
    }
  }

  return job.modelKey === "pro" ? "klingai:kling-video@3-pro" : "prunaai:p-video@0";
}

async function pollVideo(id: string, updateJob: (id: string, patch: Partial<VideoJob>) => void) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
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
