import { NextResponse } from "next/server";
import { AuthError, requireCurrentUser } from "@/services/auth";
import { spendCredits } from "@/services/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  featureId?: unknown;
  label?: unknown;
  credits?: unknown;
};

// Atomically deduct credits for a feature use and record it in the ledger.
// The balance lives in the database, so it survives logout/login and is never
// shared across accounts on the same browser.
export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const credits = typeof body.credits === "number" && Number.isFinite(body.credits) ? Math.floor(body.credits) : 0;

    if (credits <= 0) {
      return NextResponse.json({ error: "Invalid credit amount." }, { status: 400 });
    }

    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 120) : "Aria usage";
    const featureId = typeof body.featureId === "string" ? body.featureId.slice(0, 40) : null;

    const result = await spendCredits(user.id, { featureId, label, credits });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, balance: result.balance, error: "Not enough credits." },
        { status: 402 }
      );
    }

    return NextResponse.json({ ok: true, balance: result.balance });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Credit spend failed", error);
    return NextResponse.json({ error: "Could not record the credit charge." }, { status: 500 });
  }
}
