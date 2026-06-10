import { NextResponse } from "next/server";
import { getImageSidebarAssets } from "@/services/imageSidebarAssets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const images = await getImageSidebarAssets();

  return NextResponse.json({ images });
}
