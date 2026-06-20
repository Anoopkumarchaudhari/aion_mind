import { NextResponse } from "next/server";
import { getCurrentUser } from "@/services/auth";
import { readGeneratedImageFile } from "@/services/generatedImageFiles";
import { getGeneratedImage } from "@/services/serverMemory";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    imageId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { imageId } = await context.params;
  // Ownership is enforced here: getGeneratedImage only returns a row whose
  // user_id matches the signed-in user, so one account can never fetch
  // another account's image by guessing its id.
  const image = await getGeneratedImage(user.id, imageId);

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (image.base64) {
    return toImageResponse(
      Buffer.from(image.base64, "base64"),
      image.mimeType,
      `${toImageFilename(image.prompt)}.${getImageExtension(image.mimeType)}`
    );
  }

  const storedFile = readGeneratedImageFile(imageId);

  if (storedFile) {
    return toImageResponse(
      storedFile.bytes,
      storedFile.mimeType,
      `${toImageFilename(image.prompt)}.${storedFile.extension}`
    );
  }

  if (image.sourceUrl) {
    return NextResponse.redirect(image.sourceUrl);
  }

  return NextResponse.json({ error: "Image data is unavailable" }, { status: 404 });
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
