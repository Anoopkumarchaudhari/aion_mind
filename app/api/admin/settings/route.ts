import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import {
  getFeatureFlags,
  getProviderBudgets,
  saveFeatureFlags,
  saveProviderBudgets
} from "@/services/adminSettings";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SettingsBody = {
  featureFlags?: unknown;
  providerBudgets?: unknown;
};

export async function GET() {
  try {
    await requireAdminUser();
    const [featureFlags, providerBudgets] = await Promise.all([getFeatureFlags(), getProviderBudgets()]);

    return NextResponse.json({ featureFlags, providerBudgets });
  } catch (error) {
    return errorResponse(error, "Could not load settings.");
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminUser();
    const body = (await request.json()) as SettingsBody;

    const featureFlags =
      body.featureFlags !== undefined ? await saveFeatureFlags(body.featureFlags) : await getFeatureFlags();
    const providerBudgets =
      body.providerBudgets !== undefined
        ? await saveProviderBudgets(body.providerBudgets)
        : await getProviderBudgets();

    return NextResponse.json({ featureFlags, providerBudgets });
  } catch (error) {
    return errorResponse(error, "Could not update settings.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: fallback }, { status: 500 });
}
