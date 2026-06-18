import { NextResponse } from "next/server";
import { AuthError, requireCurrentUser } from "@/services/auth";
import { getCreditAccount, setFreePlan } from "@/services/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the signed-in user's authoritative wallet: plan, balance, history.
export async function GET() {
  try {
    const user = await requireCurrentUser();
    const account = await getCreditAccount(user.id);
    return NextResponse.json(account);
  } catch (error) {
    return handleError(error);
  }
}

// Downgrade to the free plan (no payment). Balance is unchanged.
export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();

    let body: { action?: unknown };
    try {
      body = (await request.json()) as { action?: unknown };
    } catch {
      body = {};
    }

    if (body.action !== "select-free") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    const account = await setFreePlan(user.id);
    return NextResponse.json(account);
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Billing account request failed", error);
  return NextResponse.json({ error: "Could not load billing account." }, { status: 500 });
}
