import { NextResponse } from "next/server";
import { clearSessionCookie, deleteSession, SESSION_COOKIE } from "@/services/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sessionId = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const response = NextResponse.json({ ok: true });

  await deleteSession(sessionId);
  clearSessionCookie(response);
  return response;
}
