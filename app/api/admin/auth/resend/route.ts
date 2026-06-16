import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { AdminGateError, dispatchAdminLoginCode, hasAdminPassword } from "@/services/adminGate";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const admin = await requireAdminUser();

    if (!(await hasAdminPassword(admin.email))) {
      return NextResponse.json({ error: "No admin password is set yet." }, { status: 409 });
    }

    const { delivered } = await dispatchAdminLoginCode(admin.email);

    return NextResponse.json({ ok: true, delivered });
  } catch (error) {
    if (error instanceof AdminGateError || error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not resend code." }, { status: 500 });
  }
}
