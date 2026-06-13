import { NextResponse } from "next/server";
import { requireAdminUser } from "@/services/adminAuth";
import { setUserActiveStatus } from "@/services/adminOverview";
import { AuthError } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{
    userId: string;
  }>;
};

type StatusBody = {
  isActive?: unknown;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const admin = await requireAdminUser();
    const { userId } = await params;

    if (userId === admin.id) {
      return NextResponse.json({ error: "You cannot change your own admin status." }, { status: 400 });
    }

    const body = (await request.json()) as StatusBody;

    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be true or false." }, { status: 400 });
    }

    const result = await setUserActiveStatus(userId, body.isActive);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Could not update user status." }, { status: 500 });
  }
}
