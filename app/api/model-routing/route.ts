import { NextResponse } from "next/server";
import {
  getAionRoutingPayload,
  saveAionRoutingSettings
} from "@/services/aionRoutingConfig";
import { AuthError, requireCurrentUser } from "@/services/auth";

export const runtime = "nodejs";

type RoutingBody = {
  settings?: unknown;
};

export async function GET() {
  try {
    await requireCurrentUser();
    return NextResponse.json(await getAionRoutingPayload());
  } catch (error) {
    return handleRoutingError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireCurrentUser();

    let body: RoutingBody;

    try {
      body = (await request.json()) as RoutingBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    await saveAionRoutingSettings(body.settings);

    return NextResponse.json(await getAionRoutingPayload());
  } catch (error) {
    return handleRoutingError(error);
  }
}

function handleRoutingError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: "Could not update model routing." }, { status: 500 });
}
