import { readdir } from "fs/promises";
import path from "path";

export type ImageSidebarAsset = {
  id: string;
  title: string;
  prompt: string;
  url: string;
};

const IMAGE_SIDEBAR_DIR = path.join(process.cwd(), "public", "image_sidebar");
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp"
]);

const KNOWN_IMAGE_COPY: Record<string, { title: string; prompt: string }> = {
  "image1.jpg": {
    title: "Neon Astral Portrait",
    prompt: "A luminous AI portrait with cosmic blue energy, polished sci-fi detail, cinematic contrast"
  },
  "image2.jpeg": {
    title: "Dreamlike Future City",
    prompt: "A futuristic skyline glowing at dusk, layered glass towers, cinematic atmosphere"
  },
  "image3.webp": {
    title: "Surreal Concept World",
    prompt: "A surreal digital landscape with refined textures, soft volumetric light, premium AI art"
  },
  "image4.png": {
    title: "Studio Color Bloom",
    prompt: "A vibrant abstract studio render with luminous particles, elegant depth, high-detail finish"
  },
  "lion-in-wimage5.webp": {
    title: "Regal Wild Vision",
    prompt: "A majestic lion in a cinematic wilderness scene, dramatic lighting, powerful composition"
  },
  "image6.avif": {
    title: "Minimal Future Object",
    prompt: "A clean futuristic object study with premium materials, refined shadows, product-grade render"
  },
  "ai-generated-serene-mounimage7.jpeg": {
    title: "Serene Mountain AI",
    prompt: "A serene mountain scene generated in a painterly AI style, mist, calm light, cinematic scale"
  },
  "image8.avif": {
    title: "Soft Digital Atmosphere",
    prompt: "A soft digital atmosphere with elegant glow, premium color grade, high-quality AI composition"
  }
};

export async function getImageSidebarAssets(): Promise<ImageSidebarAsset[]> {
  try {
    const entries = await readdir(IMAGE_SIDEBAR_DIR, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile() && SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
      .map((entry) => toImageSidebarAsset(entry.name));
  } catch {
    return [];
  }
}

function toImageSidebarAsset(filename: string): ImageSidebarAsset {
  const copy = KNOWN_IMAGE_COPY[filename] ?? buildCopyFromFilename(filename);

  return {
    id: path.parse(filename).name,
    title: copy.title,
    prompt: copy.prompt,
    url: `/image_sidebar/${encodeURIComponent(filename)}`
  };
}

function buildCopyFromFilename(filename: string) {
  const title = path
    .parse(filename)
    .name
    .replace(/\bimage\d+\b/gi, "")
    .replace(/\bwimage\d+\b/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cleanTitle = toTitleCase(title || "AI Image Inspiration");

  return {
    title: cleanTitle,
    prompt: `${cleanTitle}, premium AI image inspiration, polished composition, high quality visual style`
  };
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}
