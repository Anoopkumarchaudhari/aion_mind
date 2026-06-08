import { NextResponse } from "next/server";
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
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (image.sourceUrl && !image.base64) {
    return NextResponse.redirect(image.sourceUrl);
  }

  if (!image.base64) {
    return NextResponse.json({ error: "Image data is unavailable" }, { status: 404 });
  }

  const bytes = Buffer.from(image.base64, "base64");
  const filename = `${toImageFilename(image.prompt)}.png`;

  return new Response(bytes, {
    headers: {
      "Cache-Control": "private, max-age=86400",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Type": image.mimeType
    }
  });
}

function toImageFilename(prompt: string) {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "arya-mind-image";
}
