import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { assertCanManageTargetUser, revokeUserSessions } from "@/services/adminOverview";
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
      return NextResponse.json(
        { error: "Use logout to end your own admin session." },
        { status: 400 }
      );
    }

    // A sub-admin must not be able to revoke a super-admin's (or peer admin's)
    // sessions — same protection the sibling status/billing routes enforce.
    await assertCanManageTargetUser(admin, userId);

    const revoked = await revokeUserSessions(userId);

    return NextResponse.json({ revoked });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not revoke sessions." }, { status: 500 });
  }
}
