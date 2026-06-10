import { NextResponse } from "next/server";
import { getCurrentUser } from "@/services/auth";
import { enhancePrompt, type PromptEnhanceAttachment } from "@/services/promptEnhancer";
import {
  isAionModelId,
  isAionResearchModelId,
  type AionModelId,
  type AionResearchModelId
} from "@/types/aion";

export const runtime = "nodejs";

const MAX_PROMPT_LENGTH = 6000;
const MAX_ATTACHMENTS = 5;

type RawEnhanceBody = {
  prompt?: unknown;
  selectedModel?: unknown;
  researchModel?: unknown;
  attachments?: unknown;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: RawEnhanceBody;

  try {
    body = (await request.json()) as RawEnhanceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateRequestBody(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const enhancedPrompt = await enhancePrompt(validation);
    return NextResponse.json({ enhancedPrompt });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Prompt enhancer could not process that request."
      },
      { status: 500 }
    );
  }
}

function validateRequestBody(body: RawEnhanceBody):
  | {
      ok: true;
      prompt: string;
      selectedModel: AionModelId;
      researchModel?: AionResearchModelId;
      attachments: PromptEnhanceAttachment[];
    }
  | { ok: false; error: string } {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const selectedModel = isAionModelId(body.selectedModel) ? body.selectedModel : "aion-mind";
  const researchModel =
    selectedModel === "aion-mind-pro" && isAionResearchModelId(body.researchModel)
      ? body.researchModel
      : undefined;
  const attachments = normalizeAttachments(body.attachments);

  if (!prompt) {
    return { ok: false, error: "Prompt is required" };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: "Prompt is too long" };
  }

  if (!attachments) {
    return { ok: false, error: "Attachments are invalid" };
  }

  return {
    ok: true,
    prompt,
    selectedModel,
    researchModel,
    attachments
  };
}

function normalizeAttachments(value: unknown): PromptEnhanceAttachment[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS) {
    return null;
  }

  const attachments: PromptEnhanceAttachment[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const name = "name" in item ? item.name : undefined;
    const type = "type" in item ? item.type : undefined;
    const size = "size" in item ? item.size : undefined;
    const kind = "kind" in item ? item.kind : undefined;

    if (
      typeof name !== "string" ||
      typeof type !== "string" ||
      typeof size !== "number" ||
      !Number.isFinite(size)
    ) {
      return null;
    }

    attachments.push({
      name: name.trim().slice(0, 180) || "attachment",
      type: type.trim().slice(0, 120) || "application/octet-stream",
      size: Math.max(0, Math.floor(size)),
      kind: kind === "image" || kind === "text" || kind === "file" ? kind : undefined
    });
  }

  return attachments;
}
