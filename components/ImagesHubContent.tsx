"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Download,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  RefreshCcw,
  Save,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { AppFrame } from "@/components/AppFrame";
import { useLibraryStore } from "@/store/useLibraryStore";
import type {
  GeneratedImage,
  ImageAspectRatio,
  ImageModelKey,
  ImageProvider,
  ImageQuality
} from "@/types/workspace";

type PreviewImage = {
  id: string;
  title: string;
  prompt: string;
  url: string;
};

type ViewableImage = {
  title: string;
  prompt: string;
  url: string;
  meta?: string;
};

const providers: Array<{ value: ImageProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "runware", label: "Runware" },
  { value: "google", label: "Google Nano Banana 2" }
];

const providerModels: Record<ImageProvider, Array<{ value: ImageModelKey; label: string }>> = {
  openai: [
    { value: "default", label: "gpt-image-1-mini" },
    { value: "pro", label: "gpt-image-1 (OPENAI_IMAGE_MODEL_PRO)" }
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

const aspectRatios: Array<{ value: ImageAspectRatio; label: string }> = [
  { value: "square", label: "Square" },
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" }
];

const qualities: Array<{ value: ImageQuality; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" }
];

const fallbackPreviewImages: PreviewImage[] = [
  {
    id: "image-1",
    title: "Neon Astral Portrait",
    prompt: "A luminous AI portrait with cosmic blue energy, polished sci-fi detail, cinematic contrast",
    url: "/image_sidebar/image1.jpg"
  },
  {
    id: "image-2",
    title: "Dreamlike Future City",
    prompt: "A futuristic skyline glowing at dusk, layered glass towers, cinematic atmosphere",
    url: "/image_sidebar/image2.jpeg"
  },
  {
    id: "image-3",
    title: "Surreal Concept World",
    prompt: "A surreal digital landscape with refined textures, soft volumetric light, premium AI art",
    url: "/image_sidebar/image3.webp"
  },
  {
    id: "image-4",
    title: "Studio Color Bloom",
    prompt: "A vibrant abstract studio render with luminous particles, elegant depth, high-detail finish",
    url: "/image_sidebar/image4.png"
  },
  {
    id: "image-5",
    title: "Regal Wild Vision",
    prompt: "A majestic lion in a cinematic wilderness scene, dramatic lighting, powerful composition",
    url: "/image_sidebar/lion-in-wimage5.webp"
  },
  {
    id: "image-6",
    title: "Minimal Future Object",
    prompt: "A clean futuristic object study with premium materials, refined shadows, product-grade render",
    url: "/image_sidebar/image6.avif"
  },
  {
    id: "image-7",
    title: "Serene Mountain AI",
    prompt: "A serene mountain scene generated in a painterly AI style, mist, calm light, cinematic scale",
    url: "/image_sidebar/ai-generated-serene-mounimage7.jpeg"
  },
  {
    id: "image-8",
    title: "Soft Digital Atmosphere",
    prompt: "A soft digital atmosphere with elegant glow, premium color grade, high-quality AI composition",
    url: "/image_sidebar/image8.avif"
  }
];

const inspirationPrompts = [
  {
    label: "Product shot",
    prompt: "A premium matte black smart speaker on a reflective graphite table, dramatic studio lighting"
  },
  {
    label: "Fashion",
    prompt: "Editorial fashion portrait with iridescent fabric, soft rim light, high-end magazine style"
  },
  {
    label: "Architecture",
    prompt: "A futuristic glass library in a rain-washed city, warm interior glow, cinematic wide angle"
  },
  {
    label: "Concept art",
    prompt: "A serene floating garden above monsoon clouds, detailed concept art, luminous atmosphere"
  }
];

const PREVIEW_REFRESH_MS = 5500;
const ASSET_REFRESH_MS = 30000;
const PREVIEW_IMAGE_COUNT = 4;

type GenerateImageResponse = {
  image?: GeneratedImage;
  error?: string;
};

export function ImagesHubContent() {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<ImageProvider>("openai");
  const [modelKey, setModelKey] = useState<ImageModelKey>("default");
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>("square");
  const [quality, setQuality] = useState<ImageQuality>("auto");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [previewAssets, setPreviewAssets] = useState<PreviewImage[]>(fallbackPreviewImages);
  const [previewOffset, setPreviewOffset] = useState(0);
  const [defaultPrompt, setDefaultPrompt] = useState(fallbackPreviewImages[0].prompt);
  const [viewerImage, setViewerImage] = useState<ViewableImage | null>(null);
  const addLibraryItem = useLibraryStore((state) => state.addItem);
  const sortedImages = useMemo(
    () => [...images].sort((left, right) => right.createdAt - left.createdAt),
    [images]
  );
  const latestImage = sortedImages[0];
  const visiblePreviewImages = useMemo(
    () =>
      Array.from({ length: Math.min(PREVIEW_IMAGE_COUNT, previewAssets.length) }, (_, index) => {
        const imageIndex = (previewOffset + index) % previewAssets.length;
        return previewAssets[imageIndex];
      }),
    [previewAssets, previewOffset]
  );

  useEffect(() => {
    let ignore = false;

    async function loadPreviewAssets() {
      try {
        const response = await fetch("/api/image-sidebar", { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { images?: PreviewImage[] };
        const nextImages = Array.isArray(payload.images) ? payload.images.filter(isPreviewImage) : [];

        if (!ignore && nextImages.length > 0) {
          setPreviewAssets(nextImages);
          setPreviewOffset(0);
          setDefaultPrompt((current) => current || nextImages[0].prompt);
        }
      } catch {
        return;
      }
    }

    void loadPreviewAssets();
    const refresh = window.setInterval(loadPreviewAssets, ASSET_REFRESH_MS);

    return () => {
      ignore = true;
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPreviewOffset((current) => (current + 1) % previewAssets.length);
    }, PREVIEW_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [previewAssets.length]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const cleanPrompt = prompt.trim() || defaultPrompt;

    if (cleanPrompt.length < 2 || isGenerating) {
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
          provider,
          modelKey,
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
      setPrompt(cleanPrompt);
      setDefaultPrompt(cleanPrompt);
      toast.success("Image generated");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate image.");
    } finally {
      setIsGenerating(false);
    }
  }

  function openGenerator() {
    setShowGenerator(true);
    setDefaultPrompt(visiblePreviewImages[0]?.prompt ?? defaultPrompt);
    window.setTimeout(() => {
      document.getElementById("image-generator-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 50);
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

  function useInspiration(promptValue: string) {
    setPrompt(promptValue);
    setDefaultPrompt(promptValue);
    setError("");
  }

  function refreshPreview() {
    setPreviewOffset((current) => (current + 1) % previewAssets.length);
  }

  function openPreviewImage(image: PreviewImage) {
    setViewerImage({
      title: image.title,
      prompt: image.prompt,
      url: image.url,
      meta: "Preview inspiration"
    });
  }

  function openGeneratedImage(image: GeneratedImage) {
    setViewerImage({
      title: image.prompt.slice(0, 72) || "Generated image",
      prompt: image.revisedPrompt || image.prompt,
      url: image.url,
      meta: `${getProviderLabel(image.provider)} - ${getModelKeyLabel(image)} - ${image.size}`
    });
  }

  return (
    <AppFrame title="Images">
      <section className="route-content image-studio-route">
        <section className="image-preview-first">
          <div className="image-preview-first-heading">
            <div>
              <p className="eyebrow">Live inspiration</p>
              <h2>AI image preview</h2>
              <p>Explore rotating examples from your local image gallery before opening the generator.</p>
            </div>
            <span className="preview-live-pill">Auto</span>
          </div>

          <div className="ai-preview-grid ai-preview-grid-large">
            {visiblePreviewImages.map((image) => (
              <button
                className="ai-preview-card"
                type="button"
                key={image.id}
                onClick={() => openPreviewImage(image)}
                aria-label={`Open ${image.title}`}
              >
                <img src={image.url} alt={image.title} />
                <span className="ai-preview-open">
                  <Maximize2 size={14} />
                </span>
                <span className="ai-preview-card-copy">
                  <strong>{image.title}</strong>
                  <small>{image.prompt}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="image-preview-first-actions">
            <button className="primary-button image-generate-button spark-button" type="button" onClick={openGenerator}>
              <Sparkles className="spark-icon" size={17} />
              Generate New Image
            </button>
            <button className="ghost-button" type="button" onClick={refreshPreview}>
              <RefreshCcw size={15} />
              Rotate Images
            </button>
          </div>
        </section>

        {showGenerator ? (
          <>
            <section className="image-studio-hero" id="image-generator-panel">
              <form className="image-studio-form" onSubmit={handleSubmit}>
                <div className="image-studio-heading">
                  <div className="image-studio-title">
                    <span className="artifact-icon">
                      <ImageIcon size={18} />
                    </span>
                    <div>
                      <p className="eyebrow">AI image studio</p>
                      <h2>Create image</h2>
                    </div>
                  </div>
                  <p className="image-studio-meta">Provider: {getProviderLabel(provider)}</p>
                </div>

                <textarea
                  className="image-prompt-input"
                  value={prompt}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setError("");
                  }}
                  placeholder="Describe the image you want to create..."
                />

                <div className="image-prompt-chip-row" aria-label="Example prompts">
                  {inspirationPrompts.map((item) => (
                    <button type="button" key={item.label} onClick={() => useInspiration(item.prompt)}>
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="media-select-grid image-studio-controls">
                  <label className="media-select-field">
                    <span>Provider</span>
                    <select
                      value={provider}
                      onChange={(event) => {
                        setProvider(event.target.value as ImageProvider);
                        setModelKey("default");
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
                    <select
                      value={modelKey}
                      onChange={(event) => setModelKey(event.target.value as ImageModelKey)}
                    >
                      {providerModels[provider].map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="media-select-field">
                    <span>Frame</span>
                    <select
                      value={aspectRatio}
                      onChange={(event) => setAspectRatio(event.target.value as ImageAspectRatio)}
                    >
                      {aspectRatios.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="media-select-field">
                    <span>Quality</span>
                    <select
                      value={quality}
                      onChange={(event) => setQuality(event.target.value as ImageQuality)}
                    >
                      {qualities.map((item) => (
                        <option value={item.value} key={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {error ? <p className="image-error">{error}</p> : null}

                <div className="image-studio-actions">
                  <button className="primary-button image-generate-button spark-button" type="submit" disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="spin" size={16} /> : <Sparkles className="spark-icon" size={16} />}
                    Generate New Image
                  </button>
                  <button className="ghost-button" type="button" onClick={refreshPreview} disabled={isGenerating}>
                    <RefreshCcw size={15} />
                    Rotate Preview
                  </button>
                </div>
              </form>
            </section>

            <section className="image-workbench">
              <div className="image-workbench-panel image-output-panel">
                <div className="image-section-heading">
                  <div>
                    <p className="eyebrow">Latest render</p>
                    <h2>Output</h2>
                  </div>
                  <span>{isGenerating ? "Rendering" : latestImage ? "Ready" : "Idle"}</span>
                </div>

                <div className="image-output-surface">
                  {isGenerating ? (
                    <div className="image-empty-preview is-loading">
                      <Loader2 className="spin" size={24} />
                      <h3>Generating image</h3>
                      <p>{prompt.trim() || defaultPrompt}</p>
                    </div>
                  ) : latestImage ? (
                    <GeneratedImagePreview image={latestImage} onSave={saveImage} onOpen={openGeneratedImage} />
                  ) : (
                    <div className="image-empty-preview image-output-empty">
                      <ImageIcon size={28} />
                      <h3>Ready to generate</h3>
                      <p>{defaultPrompt}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="image-workbench-panel image-history-panel">
                <div className="image-section-heading">
                  <div>
                    <p className="eyebrow">Recent generations</p>
                    <h2>Images</h2>
                  </div>
                  <span>{sortedImages.length}</span>
                </div>

                {sortedImages.length === 0 ? (
                  <div className="image-history-empty">
                    <ImageIcon size={20} />
                    <h3>No generated images yet</h3>
                    <p>Create an image and your recent work will appear here.</p>
                  </div>
                ) : (
                  <div className="image-history-grid">
                    {sortedImages.map((image) => (
                      <article className="image-history-card" key={image.id}>
                        <button
                          className="image-thumb-button"
                          type="button"
                          onClick={() => openGeneratedImage(image)}
                          aria-label={`Open generated image for ${image.prompt}`}
                        >
                          <img className="artifact-thumb image-result-thumb" src={image.url} alt={image.prompt} />
                          <span>
                            <Maximize2 size={14} />
                          </span>
                        </button>
                        <div className="image-history-copy">
                          <h3>{image.prompt.slice(0, 64)}</h3>
                          <p>{getProviderLabel(image.provider)} - {getModelKeyLabel(image)} - {image.size}</p>
                        </div>
                        <div className="image-card-actions">
                          <ImageActions image={image} onSave={saveImage} compact />
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => removeImage(image.id)}
                            aria-label={`Remove ${image.prompt}`}
                            title="Remove"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}

        <ImageViewer image={viewerImage} onClose={() => setViewerImage(null)} />
      </section>
    </AppFrame>
  );
}

function GeneratedImagePreview({
  image,
  onSave,
  onOpen
}: {
  image: GeneratedImage;
  onSave: (image: GeneratedImage) => void;
  onOpen: (image: GeneratedImage) => void;
}) {
  return (
    <article className="image-preview-result">
      <button
        className="generated-image-main-button"
        type="button"
        onClick={() => onOpen(image)}
        aria-label={`Open generated image for ${image.prompt}`}
      >
        <img className="generated-image-main" src={image.url} alt={image.prompt} />
        <span>
          <Maximize2 size={15} />
          View full image
        </span>
      </button>
      <div className="image-preview-copy">
        <p className="eyebrow">Latest image</p>
        <h3>{image.prompt}</h3>
        {image.revisedPrompt ? <p>{image.revisedPrompt}</p> : null}
        <ImageActions image={image} onSave={onSave} />
      </div>
    </article>
  );
}

function ImageActions({
  image,
  onSave,
  compact = false
}: {
  image: GeneratedImage;
  onSave: (image: GeneratedImage) => void;
  compact?: boolean;
}) {
  return (
    <div className="generated-image-actions">
      <a
        className="ghost-button"
        href={image.url}
        download={getImageFilename(image)}
        aria-label={`Download ${image.prompt}`}
        title="Download"
      >
        <Download size={15} />
        {compact ? null : "Download"}
      </a>
      <button
        className="ghost-button"
        type="button"
        onClick={() => onSave(image)}
        aria-label={`Save ${image.prompt} to Library`}
        title="Save to Library"
      >
        <Save size={15} />
        {compact ? null : "Save"}
      </button>
    </div>
  );
}

function ImageViewer({ image, onClose }: { image: ViewableImage | null; onClose: () => void }) {
  if (!image) {
    return null;
  }

  return (
    <div className="image-viewer-overlay" role="dialog" aria-modal="true" aria-label={image.title}>
      <button className="image-viewer-backdrop" type="button" aria-label="Close image viewer" onClick={onClose} />
      <div className="image-viewer-panel">
        <button className="dialog-close image-viewer-close" type="button" onClick={onClose} aria-label="Close">
          <X size={17} />
        </button>
        <img src={image.url} alt={image.title} />
        <div className="image-viewer-copy">
          {image.meta ? <p className="eyebrow">{image.meta}</p> : null}
          <h3>{image.title}</h3>
          <p>{image.prompt}</p>
        </div>
      </div>
    </div>
  );
}

function isPreviewImage(value: unknown): value is PreviewImage {
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

function getImageFilename(image: GeneratedImage) {
  const slug = image.prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${slug || "aria-mind-image"}.png`;
}

function getLibraryContent(image: GeneratedImage) {
  return [
    image.prompt,
    image.revisedPrompt ? `Revised prompt: ${image.revisedPrompt}` : "",
    `Provider: ${getProviderLabel(image.provider)}`,
    `Sub model: ${getModelKeyLabel(image)}`,
    `Model: ${image.model}`,
    `Size: ${image.size}`,
    `Quality: ${image.quality}`
  ]
    .filter(Boolean)
    .join("\n");
}

function getProviderLabel(provider: ImageProvider) {
  switch (provider) {
    case "google":
      return "Google Nano Banana 2";
    case "runware":
      return "Runware";
    case "openai":
      return "OpenAI";
  }
}

function getModelKeyLabel(image: GeneratedImage) {
  if (image.model) {
    return image.model;
  }

  if (image.provider === "google") {
    return image.modelKey === "pro" ? "gemini-3-pro-image" : "gemini-3.1-flash-image";
  }

  if (image.provider === "runware" && image.modelKey === "default") {
    return "runware:100@1";
  }

  if (image.provider === "runware" && image.modelKey === "pro") {
    return "runware:400@1";
  }

  return "gpt-image-1";
}
