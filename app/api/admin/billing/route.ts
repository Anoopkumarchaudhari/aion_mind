import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { getBillingCatalog, saveBillingCatalog } from "@/services/adminSettings";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    return NextResponse.json({ catalog: await getBillingCatalog() });
  } catch (error) {
    return errorResponse(error, "Could not load billing catalog.");
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminUser();
    const body = await request.json();
    const catalog = await saveBillingCatalog(body);

    return NextResponse.json({ catalog });
  } catch (error) {
    return errorResponse(error, "Could not update billing catalog.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: fallback }, { status: 500 });
}
