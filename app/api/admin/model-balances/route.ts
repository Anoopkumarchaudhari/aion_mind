import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { getProviderModelBalances } from "@/services/providerModelBalances";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();

    return NextResponse.json(await getProviderModelBalances());
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Could not fetch provider model balances." },
      { status: 500 }
    );
  }
}
