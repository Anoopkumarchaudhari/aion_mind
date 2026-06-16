import { NextResponse } from "next/server";
import { addSubAdmin, listAdminMembers, removeSubAdmin, requireAdminUser, requireSuperAdmin } from "@/services/adminAuth";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MemberBody = {
  email?: unknown;
};

export async function GET() {
  try {
    const admin = await requireAdminUser();
    const members = await listAdminMembers(admin.email);

    return NextResponse.json({ members, canManage: admin.isSuperAdmin });
  } catch (error) {
    return errorResponse(error, "Could not load admins.");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireSuperAdmin();
    const body = (await request.json()) as MemberBody;
    const email = typeof body.email === "string" ? body.email : "";

    const added = await addSubAdmin(email, admin.email);
    const members = await listAdminMembers(admin.email);

    return NextResponse.json({ ok: true, added, members });
  } catch (error) {
    return errorResponse(error, "Could not add sub-admin.");
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireSuperAdmin();
    const body = (await request.json()) as MemberBody;
    const email = typeof body.email === "string" ? body.email : "";

    const removed = await removeSubAdmin(email);
    const members = await listAdminMembers(admin.email);

    return NextResponse.json({ ok: true, removed, members });
  } catch (error) {
    return errorResponse(error, "Could not remove sub-admin.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: fallback }, { status: 500 });
}
