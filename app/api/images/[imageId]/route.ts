import { NextResponse } from "next/server";
import { readGeneratedImageFile } from "@/services/generatedImageFiles";
import { getGeneratedImage } from "@/services/serverMemory";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    imageId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { imageId } = await context.params;
  const image = getGeneratedImage(imageId);

  if (!image) {
    const storedFile = readGeneratedImageFile(imageId);

    if (!storedFile) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    return toImageResponse(
      storedFile.bytes,
      storedFile.mimeType,
      `aria-mind-image.${storedFile.extension}`
    );
  }

  if (image.sourceUrl && !image.base64) {
    return NextResponse.redirect(image.sourceUrl);
  }

  if (!image.base64) {
    return NextResponse.json({ error: "Image data is unavailable" }, { status: 404 });
  }

  return toImageResponse(
    Buffer.from(image.base64, "base64"),
    image.mimeType,
    `${toImageFilename(image.prompt)}.${getImageExtension(image.mimeType)}`
  );
}

function toImageResponse(bytes: Buffer, mimeType: string, filename: string) {
  const body = new Uint8Array(bytes);

  return new Response(body, {
    headers: {
      "Cache-Control": "private, max-age=86400",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Type": mimeType
    }
  });
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

function toImageFilename(prompt: string) {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "aria-mind-image";
}
