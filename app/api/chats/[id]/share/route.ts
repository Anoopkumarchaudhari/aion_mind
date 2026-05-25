import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const origin = new URL(request.url).origin;
  const token = crypto.randomUUID().slice(0, 8);

  return NextResponse.json({
    url: `${origin}/share/${encodeURIComponent(id)}-${token}`
  });
}
