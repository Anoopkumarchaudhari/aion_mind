import { NextResponse } from "next/server";
import { AuthError, getCurrentUser } from "@/services/auth";
import { getAdminUserDetail } from "@/services/adminUserDetail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The signed-in user's own dashboard data (read-only). Reuses the same
// aggregator the admin user-log uses, but scoped to the current account.
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const detail = await getAdminUserDetail(user.id);
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("User dashboard load failed", error);
    return NextResponse.json({ error: "Could not load your dashboard." }, { status: 500 });
  }
}
