import { NextResponse } from "next/server";
import { getCurrentUser } from "@/services/auth";
import { translateWithMiniModel } from "@/services/translator";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 8000;
const MAX_LANGUAGE_LENGTH = 80;

type RawTranslateBody = {
  text?: unknown;
  targetLanguage?: unknown;
  sourceLanguage?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: RawTranslateBody;

  try {
    body = (await request.json()) as RawTranslateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateRequestBody(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const translation = await translateWithMiniModel(validation);
    return NextResponse.json({ translation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Translate could not process that request." },
      { status: 500 }
    );
  }
}

function validateRequestBody(body: RawTranslateBody):
  | {
      ok: true;
      text: string;
      targetLanguage: string;
      sourceLanguage?: string;
    }
  | { ok: false; error: string } {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const targetLanguage =
    typeof body.targetLanguage === "string" ? body.targetLanguage.trim().slice(0, MAX_LANGUAGE_LENGTH) : "";
  const sourceLanguage =
    typeof body.sourceLanguage === "string" ? body.sourceLanguage.trim().slice(0, MAX_LANGUAGE_LENGTH) : "";

  if (!text) {
    return { ok: false, error: "Text is required" };
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: "Text is too long" };
  }

  if (!targetLanguage) {
    return { ok: false, error: "Target language is required" };
  }

  return {
    ok: true,
    text,
    targetLanguage,
    sourceLanguage: sourceLanguage || undefined
  };
}
