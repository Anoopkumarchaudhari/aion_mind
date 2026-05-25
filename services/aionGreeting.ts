import { getAionModelLabel } from "@/types/aion";
import type { AionModelId, ChatAttachment, ChatMessage } from "@/types/aion";

const SIMPLE_GREETING_PATTERN =
  /^(?:h+i+|he+y+|hello+|helo+|hai+|yo|namaste|good (?:morning|afternoon|evening))(?: aion(?: mind)?)?$/;

export function getAionGreetingAnswer(
  message: string,
  selectedModel: AionModelId,
  history: ChatMessage[] = [],
  attachments: ChatAttachment[] = []
) {
  if (attachments.length > 0) {
    return null;
  }

  if (!isSimpleGreeting(message)) {
    return null;
  }

  const priorGreetingCount = history.filter(
    (item) => item.role === "user" && isSimpleGreeting(item.content)
  ).length;

  const greetingAnswers = [
    `Hi, I'm ${getAionModelLabel(selectedModel)}. How can I help you?`,
    "I'm here. What would you like to work on next?",
    "Ready when you are. What should we do next?",
    "I'm listening. Send me a task, question, or file to work on."
  ];

  return greetingAnswers[Math.min(priorGreetingCount, greetingAnswers.length - 1)];
}

function isSimpleGreeting(message: string) {
  const normalized = message
    .toLowerCase()
    .replace(/['"`~!?.(),:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return SIMPLE_GREETING_PATTERN.test(normalized);
}
