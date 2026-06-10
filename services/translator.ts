import { getTimeoutMs, truncate } from "@/providers/providerUtils";
import { callConfiguredModel } from "@/services/aionModelCalls";
import { loadAionRoutingSettings } from "@/services/aionRoutingConfig";

const TRANSLATE_SYSTEM_PROMPT = [
  "You are Aria Translate, a precise translation engine.",
  "Translate the user's text into the requested target language.",
  "Preserve meaning, formatting, names, numbers, URLs, code, and line breaks.",
  "Do not explain the translation. Return only the translated text."
].join(" ");

export type TranslateInput = {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
};

export async function translateWithMiniModel({
  text,
  targetLanguage,
  sourceLanguage
}: TranslateInput) {
  const routing = await loadAionRoutingSettings();
  const response = await callConfiguredModel(
    {
      ...routing.aion.primary,
      temperature: Math.min(routing.aion.primary.temperature, 0.15)
    },
    {
      messages: [
        {
          role: "user",
          content: [
            `Source language: ${sourceLanguage?.trim() || "Auto-detect"}`,
            `Target language: ${targetLanguage}`,
            "",
            "Text:",
            truncate(text, 8000)
          ].join("\n")
        }
      ],
      systemPrompt: TRANSLATE_SYSTEM_PROMPT,
      timeoutMs: getTimeoutMs(process.env.AION_TRANSLATE_TIMEOUT_MS, 15000)
    }
  );

  if (!response.ok || !response.content) {
    if (response.skipped) {
      throw new Error("Translate is not configured yet. Add the Aria Mind mini model credentials and restart the server.");
    }

    throw new Error(
      response.error
        ? `Translate failed: ${truncate(response.error, 180)}`
        : "Translate could not return a response."
    );
  }

  return response.content.trim();
}
