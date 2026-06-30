"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Box,
  Clapperboard,
  Download,
  Film,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Maximize2,
  Ratio,
  Save,
  Sparkles,
  Trash2,
  Wand2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { AppFrame } from "@/components/AppFrame";
import {
  hoverLift,
  scrollContainerVariants,
  scrollItemVariants,
  scrollRevealVariants
} from "@/lib/motion";
import {
  getImageCreditCharge,
  getVideoCreditCharge,
  useBillingStore
} from "@/store/useBillingStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useVideoStore } from "@/store/useVideoStore";
import type {
  GeneratedImage,
  ImageAspectRatio,
  ImageModelKey,
  ImageProvider,
  ImageQuality,
  LibraryItem,
  VideoGenerationMode,
  VideoJob,
  VideoModelKey,
  VideoProvider,
  VideoStyle
} from "@/types/workspace";

type StudioMode = "image" | "video";

type ViewableImage = {
  title: string;
  prompt: string;
  url: string;
  meta?: string;
  // Ordered list of URLs to try when downloading (same-origin endpoint first).
  downloadSources?: string[];
};

type StudioAsset = {
  id: string;
  title: string;
  prompt: string;
  url: string;
};

const BACKGROUND_ASSET_ID = "image2";
const FALLBACK_BACKGROUND_URL = "/image_sidebar/image2.jpeg";

const imageProviders: Array<{ value: ImageProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "runware", label: "Runware" },
  { value: "google", label: "Google Nano Banana 2" }
];

const imageProviderModels: Record<ImageProvider, Array<{ value: ImageModelKey; label: string }>> = {
  openai: [
    { value: "default", label: "gpt-image-1-mini" },
    { value: "pro", label: "gpt-image-1" }
  ],
  runware: [
    { value: "default", label: "runware:100@1" },
    { value: "pro", label: "runware:400@1" }
  ],
  google: [
    { value: "default", label: "gemini-3.1-flash-image" },
    { value: "pro", label: "gemini-3-pro-image" }
  ]
};

const aspectRatios: Array<{ value: ImageAspectRatio; label: string; ratio: string }> = [
  { value: "square", label: "Square", ratio: "1:1" },
  { value: "portrait", label: "Portrait", ratio: "3:4" },
  { value: "landscape", label: "Landscape", ratio: "16:9" }
];

const qualities: Array<{ value: ImageQuality; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" }
];

const videoStyles: Array<{ value: VideoStyle; label: string }> = [
  { value: "cinematic", label: "Cinematic" },
  { value: "animated", label: "Animated" },
  { value: "realistic", label: "Realistic" },
  { value: "abstract", label: "Abstract" }
];

const videoProviders: Array<{ value: VideoProvider; label: string }> = [
  { value: "runware", label: "Runware" },
  { value: "google", label: "Google Veo" }
];

const videoProviderDurations: Record<VideoProvider, number[]> = {
  runware: [5, 10],
  google: [4, 6, 8]
};

const videoProviderModels: Record<VideoProvider, Array<{ value: VideoModelKey; label: string }>> = {
  runware: [
    { value: "default", label: "prunaai:p-video@0" },
    { value: "pro", label: "klingai:kling-video@3-pro" }
  ],
  google: [
    { value: "lite", label: "veo-3.1-fast (lite)" },
    { value: "default", label: "veo-3.1-fast" },
    { value: "pro", label: "veo-3.1" }
  ]
};

const promptSuggestions = [
  "A luminous AI portrait with cosmic blue energy, polished sci-fi detail, cinematic contrast",
  "A futuristic glass library in a rain-washed city, warm interior glow, cinematic wide angle",
  "A cinematic tracking shot through a rain-glossed neon market at night",
  "A serene floating garden above monsoon clouds, luminous atmosphere"
];

const MAX_INPUT_IMAGE_BYTES = 8 * 1024 * 1024;

type GenerateImageResponse = {
  image?: GeneratedImage;
  error?: string;
};

export function StudioHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode: StudioMode = searchParams?.get("tab") === "video" ? "video" : "image";

  const [mode, setMode] = useState<StudioMode>(initialMode);
  // "create" is the generation surface; "library" shows saved images in-page.
  const [view, setView] = useState<"create" | "library">("create");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Image state
  const [imageProvider, setImageProvider] = useState<ImageProvider>("openai");
  const [imageModelKey, setImageModelKey] = useState<ImageModelKey>("default");
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>("square");
  const [quality, setQuality] = useState<ImageQuality>("auto");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [viewerImage, setViewerImage] = useState<ViewableImage | null>(null);
  const [galleryAssets, setGalleryAssets] = useState<StudioAsset[]>([]);
  const [backgroundUrl, setBackgroundUrl] = useState(FALLBACK_BACKGROUND_URL);

  // Video state
  const [videoProvider, setVideoProvider] = useState<VideoProvider>("runware");
  const [videoModelKey, setVideoModelKey] = useState<VideoModelKey>("default");
  const [videoStyle, setVideoStyle] = useState<VideoStyle>("cinematic");
  const [duration, setDuration] = useState(5);
  const [videoInputMode, setVideoInputMode] = useState<VideoGenerationMode>("text");
  const [inputImageData, setInputImageData] = useState("");
  const [inputImageName, setInputImageName] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addLibraryItem = useLibraryStore((state) => state.addItem);
  const libraryItems = useLibraryStore((state) => state.items);
  const removeLibraryItem = useLibraryStore((state) => state.removeItem);
  const jobs = useVideoStore((state) => state.jobs);
  const createJob = useVideoStore((state) => state.createJob);
  const updateJob = useVideoStore((state) => state.updateJob);

  const sortedImages = useMemo(
    () => [...images].sort((left, right) => right.createdAt - left.createdAt),
    [images]
  );
  const latestImage = sortedImages[0];
  const sortedJobs = useMemo(
    () => [...jobs].sort((left, right) => right.createdAt - left.createdAt),
    [jobs]
  );
  const savedImages = useMemo(
    () =>
      libraryItems
        .filter((item) => item.type === "image" && Boolean(item.url))
        .sort((left, right) => right.createdAt - left.createdAt),
    [libraryItems]
  );

  useEffect(() => {
    router.prefetch("/videos");
    router.prefetch("/library");
  }, [router]);

  useEffect(() => {
    let ignore = false;

    fetch("/api/image-sidebar", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { images?: StudioAsset[] } | null) => {
        if (ignore || !payload?.images?.length) {
          return;
        }

        const assets = payload.images.filter(isStudioAsset);
        const background = assets.find((asset) => asset.id === BACKGROUND_ASSET_ID);

        if (background) {
          setBackgroundUrl(background.url);
        }

        setGalleryAssets(assets.filter((asset) => asset.id !== BACKGROUND_ASSET_ID));
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

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
        setVideoInputMode("image");
        setMode("video");
        setError("");
      }
    };
    reader.onerror = () => setError("Could not read the image file.");
    reader.readAsDataURL(file);
  }

  function clearInputImage() {
    setInputImageData("");
    setInputImageName("");
    setVideoInputMode("text");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const cleanPrompt = prompt.trim();

    if (cleanPrompt.length < 2) {
      setError("Describe what you want to create first.");
      return;
    }

    if (isGenerating) {
      return;
    }

    if (mode === "image") {
      await generateImage(cleanPrompt);
    } else {
      await generateVideo(cleanPrompt);
    }
  }

  async function generateImage(cleanPrompt: string) {
    const creditCharge = getImageCreditCharge(imageModelKey, quality);
    const charged = await useBillingStore.getState().spendCredits(creditCharge);

    if (!charged) {
      setError(`Need ${creditCharge.credits} credits for ${creditCharge.label}.`);
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cleanPrompt,
          provider: imageProvider,
          modelKey: imageModelKey,
          aspectRatio,
          quality
        })
      });
      const data = (await response.json()) as GenerateImageResponse;

      if (!response.ok || !data.image) {
        throw new Error(data.error || "Could not generate image.");
      }

      const generatedImage = data.image;
      setImages((current) => [
        generatedImage,
        ...current.filter((image) => image.id !== generatedImage.id)
      ]);
      toast.success("Image generated");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate image.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateVideo(cleanPrompt: string) {
    if (videoInputMode === "image" && !inputImageData) {
      setError("Add a first-frame image before generating.");
      return;
    }

    const creditCharge = getVideoCreditCharge(videoProvider, videoModelKey, duration, videoInputMode);
    const charged = await useBillingStore.getState().spendCredits(creditCharge);

    if (!charged) {
      setError(`Need ${creditCharge.credits} credits for ${creditCharge.label}.`);
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const id = await createJob({
        prompt: cleanPrompt,
        provider: videoProvider,
        style: videoStyle,
        duration,
        mode: videoInputMode,
        modelKey: videoModelKey,
        inputImageData: videoInputMode === "image" ? inputImageData : undefined
      });
      await pollVideo(id, updateJob);
      router.push(`/videos/${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start video generation.");
    } finally {
      setIsGenerating(false);
    }
  }

  function saveImage(image: GeneratedImage) {
    addLibraryItem({
      type: "image",
      title: image.prompt.slice(0, 64) || "Generated image",
      url: image.url,
      content: getLibraryContent(image)
    });
    toast.success("Image saved to Library");
  }

  function removeImage(id: string) {
    setImages((current) => current.filter((image) => image.id !== id));
  }

  async function downloadImage(image: GeneratedImage) {
    // Prefer the same-origin `/api/images/:id` endpoint, which serves the raw
    // bytes and sidesteps the cross-origin `download`-attribute restriction.
    const ok = await triggerImageDownload(
      [`/api/images/${image.id}`, image.url],
      slugifyPrompt(image.prompt)
    );

    if (!ok) {
      window.open(image.url, "_blank", "noopener");
      toast.error("Could not download automatically — opened in a new tab.");
    }
  }

  function openGeneratedImage(image: GeneratedImage) {
    setViewerImage({
      title: image.prompt.slice(0, 72) || "Generated image",
      prompt: image.revisedPrompt || image.prompt,
      url: image.url,
      meta: `${getImageProviderLabel(image.provider)} - ${image.size}`,
      downloadSources: [`/api/images/${image.id}`, image.url]
    });
  }

  function enhancePrompt() {
    if (prompt.trim()) {
      return;
    }

    const next = promptSuggestions[Math.floor((sortedImages.length + sortedJobs.length) % promptSuggestions.length)];
    setPrompt(next);
    setError("");
  }

  function useAssetPrompt(asset: StudioAsset) {
    setMode("image");
    setPrompt(asset.prompt);
    setError("");
  }

  async function downloadAsset(asset: StudioAsset) {
    const ok = await triggerImageDownload([asset.url], slugifyPrompt(asset.title));

    if (!ok) {
      window.open(asset.url, "_blank", "noopener");
    }
  }

  function openAssetImage(asset: StudioAsset) {
    setViewerImage({
      title: asset.title,
      prompt: asset.prompt,
      url: asset.url,
      meta: "Featured inspiration",
      downloadSources: [asset.url]
    });
  }

  function openSavedImage(item: LibraryItem) {
    if (!item.url) {
      return;
    }

    setViewerImage({
      title: item.title,
      prompt: item.content || item.title,
      url: item.url,
      meta: "Saved image",
      downloadSources: [item.url]
    });
  }

  async function downloadSavedImage(item: LibraryItem) {
    if (!item.url) {
      return;
    }

    const ok = await triggerImageDownload([item.url], slugifyPrompt(item.title));

    if (!ok) {
      window.open(item.url, "_blank", "noopener");
    }
  }

  const activeAspect = aspectRatios.find((item) => item.value === aspectRatio) ?? aspectRatios[0];
  const providerLabel =
    mode === "image"
      ? getImageProviderLabel(imageProvider)
      : getVideoProviderLabel(videoProvider);

  const pageStyle = { "--studio-bg": `url("${backgroundUrl}")` } as CSSProperties;

  return (
    <AppFrame title="Studio" hideSidebar>
      <section className="route-content studio-route" style={pageStyle}>
        <div className="studio-page-overlay" aria-hidden="true" />
        <div className="studio-shell">
          <aside className="studio-toolbar" aria-label="Studio tools">
            <button
              type="button"
              className={view === "create" && mode === "image" ? "studio-tool is-active" : "studio-tool"}
              onClick={() => {
                setMode("image");
                setView("create");
              }}
            >
              <span className="studio-tool-icon"><ImageIcon size={20} /></span>
              Image
            </button>
            <button
              type="button"
              className={view === "create" && mode === "video" ? "studio-tool is-active" : "studio-tool"}
              onClick={() => {
                setMode("video");
                setView("create");
              }}
            >
              <span className="studio-tool-icon"><Film size={20} /></span>
              Video
            </button>
            <button
              type="button"
              className="studio-tool"
              onClick={() => {
                setView("create");
                fileInputRef.current?.click();
              }}
            >
              <span className="studio-tool-icon"><ImagePlus size={20} /></span>
              Frame
            </button>
            <button
              type="button"
              className={view === "library" ? "studio-tool is-active" : "studio-tool"}
              onClick={() => setView("library")}
            >
              <span className="studio-tool-icon"><Save size={20} /></span>
              Library
            </button>
            <a className="studio-tool" href="/podcast">
              <span className="studio-tool-icon"><Clapperboard size={20} /></span>
              Podcast
            </a>
          </aside>

          <div className="studio-main">
        <motion.div
          className="studio-stage"
          variants={scrollRevealVariants}
          initial="hidden"
          animate="show"
        >
          <div className="studio-hero-copy">
            <p className="studio-eyebrow">Aria Studio</p>
            <h1 className="studio-headline">Yours to create</h1>
            <p className="studio-subline">
              One canvas for image and video. Describe it, pick a look, and generate.
            </p>
          </div>
        </motion.div>

        {view === "create" ? (
          <>
        <div className="studio-creator-dock">
          <form className="studio-prompt-bar" onSubmit={handleSubmit}>
            <div className="studio-prompt-top">
              <button
                type="button"
                className="studio-attach"
                onClick={() => fileInputRef.current?.click()}
                title="Add a first-frame image (video)"
                aria-label="Add a first-frame image"
              >
                <ImagePlus size={18} />
              </button>
              <input
                ref={fileInputRef}
                className="studio-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
              />
              <textarea
                className="studio-prompt-input"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setError("");
                }}
                rows={1}
                placeholder={
                  mode === "image"
                    ? "Describe an image to generate..."
                    : "Describe a video scene to generate..."
                }
              />
            </div>

            {videoInputMode === "image" && inputImageData ? (
              <div className="studio-frame-chip">
                <img src={inputImageData} alt="" />
                <span>{inputImageName || "First frame"}</span>
                <button type="button" onClick={clearInputImage} aria-label="Remove first frame">
                  <X size={13} />
                </button>
              </div>
            ) : null}

            <div className="studio-prompt-controls">
              <div className="studio-mode-toggle" role="tablist" aria-label="Generation type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "image"}
                  className={mode === "image" ? "is-active" : ""}
                  onClick={() => setMode("image")}
                >
                  <ImageIcon size={15} />
                  Image
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "video"}
                  className={mode === "video" ? "is-active" : ""}
                  onClick={() => setMode("video")}
                >
                  <Film size={15} />
                  Video
                </button>
              </div>

              <div className="studio-control-spacer" />

              {mode === "image" ? (
                <>
                  <label className="studio-pill" title="Aspect ratio">
                    <Ratio size={15} />
                    <select
                      value={aspectRatio}
                      onChange={(event) => setAspectRatio(event.target.value as ImageAspectRatio)}
                    >
                      {aspectRatios.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.ratio}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="studio-pill" title="Quality">
                    <Wand2 size={15} />
                    <select value={quality} onChange={(event) => setQuality(event.target.value as ImageQuality)}>
                      {qualities.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="studio-pill studio-pill-model" title="Model">
                    <Box size={15} />
                    <select
                      value={`${imageProvider}:${imageModelKey}`}
                      onChange={(event) => {
                        const [nextProvider, nextModel] = event.target.value.split(":") as [
                          ImageProvider,
                          ImageModelKey
                        ];
                        setImageProvider(nextProvider);
                        setImageModelKey(nextModel);
                      }}
                    >
                      {imageProviders.map((providerItem) =>
                        imageProviderModels[providerItem.value].map((modelItem) => (
                          <option
                            value={`${providerItem.value}:${modelItem.value}`}
                            key={`${providerItem.value}:${modelItem.value}`}
                          >
                            {providerItem.label} - {modelItem.label}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="studio-pill" title="Style">
                    <Sparkles size={15} />
                    <select value={videoStyle} onChange={(event) => setVideoStyle(event.target.value as VideoStyle)}>
                      {videoStyles.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="studio-pill" title="Duration">
                    <Clapperboard size={15} />
                    <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                      {videoProviderDurations[videoProvider].map((item) => (
                        <option value={item} key={item}>
                          {item}s
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="studio-pill studio-pill-model" title="Model">
                    <Box size={15} />
                    <select
                      value={`${videoProvider}:${videoModelKey}`}
                      onChange={(event) => {
                        const [nextProvider, nextModel] = event.target.value.split(":") as [
                          VideoProvider,
                          VideoModelKey
                        ];
                        setVideoProvider(nextProvider);
                        setVideoModelKey(nextModel);
                        setDuration(videoProviderDurations[nextProvider][0] ?? 5);
                      }}
                    >
                      {videoProviders.map((providerItem) =>
                        videoProviderModels[providerItem.value].map((modelItem) => (
                          <option
                            value={`${providerItem.value}:${modelItem.value}`}
                            key={`${providerItem.value}:${modelItem.value}`}
                          >
                            {providerItem.label} - {modelItem.label}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                </>
              )}

              <button
                type="button"
                className="studio-enhance"
                onClick={enhancePrompt}
                title="Suggest a prompt"
                aria-label="Suggest a prompt"
              >
                <Sparkles size={16} />
              </button>

              <button className="studio-generate" type="submit" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="spin" size={16} /> : null}
                {isGenerating ? "Generating" : "Generate"}
              </button>
            </div>
          </form>

          {error ? <p className="studio-error">{error}</p> : null}

          <p className="studio-context-note">
            {mode === "image" ? "Image" : "Video"} - {providerLabel}
            {mode === "image" ? ` - ${activeAspect.label}` : ` - ${duration}s`}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {mode === "image" ? (
            <motion.div
              key="image-results"
              className="studio-results"
              variants={scrollRevealVariants}
              initial="hidden"
              animate="show"
              exit="hidden"
            >
              {sortedImages.length > 0 ? (
                <div className="studio-results-heading">
                  <h2>Generations</h2>
                  <span>{sortedImages.length}</span>
                </div>
              ) : null}

              {isGenerating ? (
                <div className="studio-output-loading">
                  <Loader2 className="spin" size={24} />
                  <p>{prompt.trim() || "Generating image"}</p>
                </div>
              ) : null}

              {latestImage && !isGenerating ? (
                <div className="studio-feature-shot">
                  <button
                    type="button"
                    className="studio-feature-image"
                    onClick={() => openGeneratedImage(latestImage)}
                    aria-label="Open latest image"
                  >
                    <img src={latestImage.url} alt={latestImage.prompt} />
                    <span className="studio-feature-open"><Maximize2 size={15} /> View</span>
                  </button>
                  <div className="studio-feature-actions">
                    <button className="ghost-button" type="button" onClick={() => downloadImage(latestImage)} title="Download">
                      <Download size={15} />
                    </button>
                    <button className="ghost-button" type="button" onClick={() => saveImage(latestImage)} title="Save to Library">
                      <Save size={15} />
                    </button>
                    <button className="ghost-button" type="button" onClick={() => removeImage(latestImage.id)} title="Remove">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ) : null}

              {sortedImages.length > 1 ? (
                <motion.div
                  className="studio-grid"
                  variants={scrollContainerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {sortedImages.slice(1).map((image) => (
                    <motion.article className="studio-card" key={image.id} variants={scrollItemVariants} whileHover={hoverLift}>
                      <button
                        type="button"
                        className="studio-card-thumb"
                        onClick={() => openGeneratedImage(image)}
                        aria-label={`Open ${image.prompt}`}
                      >
                        <img src={image.url} alt={image.prompt} />
                        <span><Maximize2 size={14} /></span>
                      </button>
                      <div className="studio-card-body">
                        <h3>{image.prompt.slice(0, 60)}</h3>
                        <p>{getImageProviderLabel(image.provider)} - {image.size}</p>
                      </div>
                      <div className="studio-card-actions">
                        <button className="ghost-button" type="button" onClick={() => downloadImage(image)} title="Download">
                          <Download size={15} />
                        </button>
                        <button className="ghost-button" type="button" onClick={() => saveImage(image)} title="Save to Library">
                          <Save size={15} />
                        </button>
                        <button className="ghost-button" type="button" onClick={() => removeImage(image.id)} title="Remove">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.article>
                  ))}
                </motion.div>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="video-results"
              className="studio-results"
              variants={scrollRevealVariants}
              initial="hidden"
              animate="show"
              exit="hidden"
            >
              <div className="studio-results-heading">
                <h2>Video sessions</h2>
                <span>{sortedJobs.length}</span>
              </div>

              {sortedJobs.length > 0 ? (
                <motion.div
                  className="studio-grid"
                  variants={scrollContainerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {sortedJobs.map((job) => (
                    <motion.a
                      className="studio-card studio-video-card"
                      href={`/videos/${job.id}`}
                      key={job.id}
                      variants={scrollItemVariants}
                      whileHover={hoverLift}
                    >
                      <div className="studio-card-thumb">
                        {job.thumbnailUrl ? <img src={job.thumbnailUrl} alt="" /> : <div className="studio-video-placeholder"><Film size={22} /></div>}
                      </div>
                      <div className="studio-card-body">
                        <h3>{job.prompt.slice(0, 60)}</h3>
                        <p>{getVideoProviderLabel(job.provider)} - {job.duration}s - {job.status}</p>
                      </div>
                    </motion.a>
                  ))}
                </motion.div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>

        <section className="studio-featured" aria-label="Featured inspiration">
          <div className="studio-featured-head">
            <p className="studio-eyebrow">Featured</p>
            <h2>Inspiration</h2>
          </div>
          <div className="studio-featured-strip">
            {galleryAssets.map((asset) => (
              <article className="studio-rail-card" key={asset.id}>
                <button
                  type="button"
                  className="studio-rail-thumb"
                  onClick={() => openAssetImage(asset)}
                  aria-label={`Open ${asset.title}`}
                >
                  <img src={asset.url} alt={asset.title} loading="lazy" />
                </button>
                <div className="studio-rail-overlay">
                  <p className="studio-rail-prompt">{asset.prompt}</p>
                  <div className="studio-rail-actions">
                    <button type="button" className="studio-rail-use" onClick={() => useAssetPrompt(asset)}>
                      <Wand2 size={13} />
                      Use prompt
                    </button>
                    <button
                      type="button"
                      className="studio-rail-download"
                      onClick={() => downloadAsset(asset)}
                      title="Download"
                      aria-label={`Download ${asset.title}`}
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
          </>
        ) : (
          <section className="studio-library" aria-label="Saved images">
            <div className="studio-results-heading">
              <h2>Saved images</h2>
              <span>{savedImages.length}</span>
            </div>
            {savedImages.length > 0 ? (
              <motion.div
                className="studio-grid"
                variants={scrollContainerVariants}
                initial="hidden"
                animate="show"
              >
                {savedImages.map((item) => (
                  <motion.article className="studio-card" key={item.id} variants={scrollItemVariants} whileHover={hoverLift}>
                    <button
                      type="button"
                      className="studio-card-thumb"
                      onClick={() => openSavedImage(item)}
                      aria-label={`Open ${item.title}`}
                    >
                      <img src={item.url ?? ""} alt={item.title} />
                      <span><Maximize2 size={14} /></span>
                    </button>
                    <div className="studio-card-body">
                      <h3>{item.title.slice(0, 60)}</h3>
                    </div>
                    <div className="studio-card-actions">
                      <button className="ghost-button" type="button" onClick={() => downloadSavedImage(item)} title="Download">
                        <Download size={15} />
                      </button>
                      <button className="ghost-button" type="button" onClick={() => removeLibraryItem(item.id)} title="Remove from library">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.article>
                ))}
              </motion.div>
            ) : (
              <div className="studio-empty">
                <h3>No saved images yet</h3>
                <p>Generate an image and save it to see it here.</p>
              </div>
            )}
          </section>
        )}
          </div>
        </div>

        <ImageViewer image={viewerImage} onClose={() => setViewerImage(null)} />
      </section>
    </AppFrame>
  );
}

function ImageViewer({ image, onClose }: { image: ViewableImage | null; onClose: () => void }) {
  if (!image) {
    return null;
  }

  return (
    <motion.div
      className="image-viewer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={image.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button className="image-viewer-backdrop" type="button" aria-label="Close image viewer" onClick={onClose} />
      <motion.div
        className="image-viewer-panel"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        <button className="dialog-close image-viewer-close" type="button" onClick={onClose} aria-label="Close">
          <X size={17} />
        </button>
        <img src={image.url} alt={image.title} />
        <div className="image-viewer-copy">
          {image.meta ? <p className="eyebrow">{image.meta}</p> : null}
          <h3>{image.title}</h3>
          <p>{image.prompt}</p>
          <button
            type="button"
            className="image-viewer-download"
            onClick={async () => {
              const ok = await triggerImageDownload(
                image.downloadSources ?? [image.url],
                slugifyPrompt(image.prompt || image.title)
              );

              if (!ok) {
                window.open(image.url, "_blank", "noopener");
              }
            }}
          >
            <Download size={16} />
            Download
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function isStudioAsset(value: unknown): value is StudioAsset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.prompt === "string" &&
    typeof record.url === "string"
  );
}

function slugifyPrompt(text: string) {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "aria-studio-image";
}

// Fetch the image bytes and trigger a real file download from a blob. A plain
// `<a download>` is ignored by browsers for cross-origin URLs (OpenAI/Runware
// CDNs), so we go through a blob instead. Tries each source in order and
// returns true on the first success.
async function triggerImageDownload(sources: Array<string | undefined>, baseName: string) {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    try {
      const response = await fetch(source);

      if (!response.ok) {
        continue;
      }

      const blob = await response.blob();
      const extension =
        blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = `${baseName}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      return true;
    } catch {
      // Try the next source.
    }
  }

  return false;
}

function getLibraryContent(image: GeneratedImage) {
  return [
    image.prompt,
    image.revisedPrompt ? `Revised prompt: ${image.revisedPrompt}` : "",
    `Provider: ${getImageProviderLabel(image.provider)}`,
    `Model: ${image.model}`,
    `Size: ${image.size}`,
    `Quality: ${image.quality}`
  ]
    .filter(Boolean)
    .join("\n");
}

function getImageProviderLabel(provider: ImageProvider) {
  switch (provider) {
    case "google":
      return "Google Nano Banana 2";
    case "runware":
      return "Runware";
    case "openai":
      return "OpenAI";
  }
}

function getVideoProviderLabel(provider: VideoProvider | undefined) {
  return provider === "google" ? "Google Veo" : "Runware";
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
