import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/services/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    const response = NextResponse.json({ user: null }, { status: 401 });
    clearSessionCookie(response);
    return response;
  }

  return NextResponse.json({ user });
}
