import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { getBillingOverrides, saveBillingOverrides } from "@/services/adminSettings";
import { mergeBillingCatalog } from "@/services/billingCatalog";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const overrides = await getBillingOverrides();

    return NextResponse.json({ overrides, catalog: mergeBillingCatalog(overrides) });
  } catch (error) {
    return errorResponse(error, "Could not load billing catalog.");
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminUser();
    const body = await request.json();
    const overrides = await saveBillingOverrides(body);

    return NextResponse.json({ overrides, catalog: mergeBillingCatalog(overrides) });
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
