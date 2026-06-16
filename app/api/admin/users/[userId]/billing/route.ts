import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { assertCanManageTargetUser, updateUserBilling } from "@/services/adminOverview";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{
    userId: string;
  }>;
};

type BillingBody = {
  planId?: unknown;
  credits?: unknown;
  creditsDelta?: unknown;
  role?: unknown;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const admin = await requireAdminUser();
    const { userId } = await params;

    if (userId === admin.id) {
      return NextResponse.json({ error: "You cannot change your own billing here." }, { status: 400 });
    }

    await assertCanManageTargetUser(admin, userId);

    const body = (await request.json()) as BillingBody;

    const changes: { planId?: string; credits?: number; creditsDelta?: number; role?: string } = {};

    if (typeof body.planId === "string") changes.planId = body.planId;
    if (typeof body.role === "string") changes.role = body.role;
    if (typeof body.credits === "number") changes.credits = body.credits;
    if (typeof body.creditsDelta === "number") changes.creditsDelta = body.creditsDelta;

    const result = await updateUserBilling(userId, changes);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not update user billing." }, { status: 500 });
  }
}
