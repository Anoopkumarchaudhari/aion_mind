import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { assertCanManageTargetUser, deleteUserAccount } from "@/services/adminOverview";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{
    userId: string;
  }>;
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const admin = await requireAdminUser();
    const { userId } = await params;

    if (userId === admin.id) {
      return NextResponse.json({ error: "You cannot delete your own admin account." }, { status: 400 });
    }

    await assertCanManageTargetUser(admin, userId);

    const result = await deleteUserAccount(userId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not delete user." }, { status: 500 });
  }
}
