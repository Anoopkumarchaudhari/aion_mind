import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { getAdminOverview } from "@/services/adminOverview";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdminUser();

    return NextResponse.json(await getAdminOverview(admin));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not load admin overview." }, { status: 500 });
  }
}
