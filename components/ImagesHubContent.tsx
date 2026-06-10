"use client";

import { useMemo, useState, type FormEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Download,
  Image as ImageIcon,
  Loader2,
  Save,
  Sparkles,
  Trash2
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

const providers: Array<{ value: ImageProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "runware", label: "Runware" }
];
const providerModels: Record<ImageProvider, Array<{ value: ImageModelKey; label: string }>> = {
  openai: [
    { value: "default", label: "Default" },
    { value: "pro", label: "Pro" }
  ],
  runware: [
    { value: "default", label: "FLUX Schnell" },
    { value: "pro", label: "Pro" }
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
  const addLibraryItem = useLibraryStore((state) => state.addItem);
  const sortedImages = useMemo(
    () => [...images].sort((left, right) => right.createdAt - left.createdAt),
    [images]
  );
  const latestImage = sortedImages[0];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const cleanPrompt = prompt.trim();

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
      toast.success("Image generated");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate image.");
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

  return (
    <AppFrame title="Images">
      <section className="route-content">
        <div className="image-generator-shell">
          <form className="image-generator-panel" onSubmit={handleSubmit}>
            <div className="image-generator-heading">
              <span className="artifact-icon">
                <ImageIcon size={18} />
              </span>
              <div>
                <p className="eyebrow">Prompt to image</p>
                <h2>Create image</h2>
              </div>
            </div>

            <textarea
              className="image-prompt-input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="A cinematic portrait of a glass city floating above monsoon clouds..."
            />

            <div className="image-control-grid">
              <fieldset className="image-control-group">
                <legend>Provider</legend>
                <div className="chip-row">
                  {providers.map((item) => (
                    <button
                      className={item.value === provider ? "is-active" : ""}
                      type="button"
                      key={item.value}
                      onClick={() => {
                        setProvider(item.value);
                        setModelKey("default");
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="image-control-group">
                <legend>Sub model</legend>
                <div className="chip-row">
                  {providerModels[provider].map((item) => (
                    <button
                      className={item.value === modelKey ? "is-active" : ""}
                      type="button"
                      key={item.value}
                      onClick={() => setModelKey(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="image-control-group">
                <legend>Frame</legend>
                <div className="chip-row">
                  {aspectRatios.map((item) => (
                    <button
                      className={item.value === aspectRatio ? "is-active" : ""}
                      type="button"
                      key={item.value}
                      onClick={() => setAspectRatio(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="image-control-group">
                <legend>Quality</legend>
                <div className="chip-row">
                  {qualities.map((item) => (
                    <button
                      className={item.value === quality ? "is-active" : ""}
                      type="button"
                      key={item.value}
                      onClick={() => setQuality(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            {error ? <p className="image-error">{error}</p> : null}

            <button className="primary-button full" type="submit" disabled={!prompt.trim() || isGenerating}>
              {isGenerating ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
              Generate
            </button>
          </form>

          <div className="image-preview-panel">
            {latestImage ? (
              <GeneratedImagePreview image={latestImage} onSave={saveImage} />
            ) : (
              <div className="image-empty-preview">
                <ImageIcon size={28} />
                <h3>No image yet</h3>
                <p>Generated results will appear here.</p>
              </div>
            )}
          </div>
        </div>

        <div className="page-toolbar">
          <div>
            <p className="eyebrow">Recent generations</p>
            <h2>Images</h2>
          </div>
        </div>

        {sortedImages.length === 0 ? (
          <div className="empty-panel">
            <h3>No generated images yet</h3>
            <p>Create an image from a prompt and it will appear here.</p>
          </div>
        ) : (
          <div className="artifact-grid image-result-grid">
            {sortedImages.map((image) => (
              <article className="artifact-card image-generation-card" key={image.id}>
                <img className="artifact-thumb image-result-thumb" src={image.url} alt={image.prompt} />
                <div className="artifact-card-body">
                  <h3>{image.prompt.slice(0, 72)}</h3>
                  <p>
                    {getProviderLabel(image.provider)} - {getModelKeyLabel(image)} - {image.aspectRatio} - {image.quality} - {image.size}
                  </p>
                </div>
                <div className="artifact-meta">
                  <span>{image.model}</span>
                  <time>{formatDistanceToNow(image.createdAt, { addSuffix: true })}</time>
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
      </section>
    </AppFrame>
  );
}

function GeneratedImagePreview({
  image,
  onSave
}: {
  image: GeneratedImage;
  onSave: (image: GeneratedImage) => void;
}) {
  return (
    <article className="image-preview-result">
      <img className="generated-image-main" src={image.url} alt={image.prompt} />
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
  return provider === "runware" ? "Runware" : "OpenAI";
}

function getModelKeyLabel(image: GeneratedImage) {
  if (image.provider === "runware" && image.modelKey === "default") {
    return "FLUX Schnell";
  }

  return image.modelKey === "pro" ? "Pro" : "Default";
}
