import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { StoredGeneratedImage } from "@/types/workspace";

const GENERATED_IMAGE_DIR = path.join(process.cwd(), "data", "generated-images");
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

type StoredImageFile = {
  bytes: Buffer;
  mimeType: string;
  extension: string;
};

export function persistGeneratedImageFile(image: StoredGeneratedImage) {
  if (!image.base64) {
    return;
  }

  const extension = getImageExtension(image.mimeType);
  const bytes = Buffer.from(image.base64, "base64");

  mkdirSync(GENERATED_IMAGE_DIR, { recursive: true });
  writeFileSync(path.join(GENERATED_IMAGE_DIR, `${image.id}.${extension}`), bytes);
}

export function readGeneratedImageFile(id: string): StoredImageFile | null {
  if (!/^[a-z0-9-]+$/i.test(id)) {
    return null;
  }

  for (const extension of IMAGE_EXTENSIONS) {
    const filePath = path.join(GENERATED_IMAGE_DIR, `${id}.${extension}`);

    if (existsSync(filePath)) {
      return {
        bytes: readFileSync(filePath),
        mimeType: getMimeType(extension),
        extension
      };
    }
  }

  return null;
}

function getImageExtension(mimeType: string) {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/png":
    default:
      return "png";
  }
}

function getMimeType(extension: string) {
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
    default:
      return "image/png";
  }
}
