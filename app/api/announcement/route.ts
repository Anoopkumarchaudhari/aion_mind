import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/services/adminSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: the currently active broadcast announcement (or null). No auth. */
export async function GET() {
  try {
    const { announcement } = await getFeatureFlags();
    if (!announcement.enabled || !announcement.message.trim()) {
      return NextResponse.json({ announcement: null });
    }
    return NextResponse.json({
      announcement: { tone: announcement.tone, message: announcement.message }
    });
  } catch {
    return NextResponse.json({ announcement: null });
  }
}
