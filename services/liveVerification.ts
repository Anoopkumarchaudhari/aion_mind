import type { ChatAttachment } from "@/types/aion";

const CURRENT_TIME_PATTERN =
  /\b(?:current|currently|latest|today|tonight|now|right now|recent|recently|newest|updated|up to date|live|breaking|this week|this month|this year|as of|at present|incumbent)\b/i;

const CURRENT_YEAR_PATTERN = /\b20(?:2[6-9]|[3-9]\d)\b/;

const VOLATILE_FACT_PATTERN =
  /\b(?:chief minister|prime minister|president|governor|mayor|minister|mp\b|mla\b|senator|ceo|cto|cfo|chair(?:man|woman|person)?|leader|head coach|captain|stock|share price|crypto|exchange rate|weather|forecast|score|fixture|schedule|election|result|law|rule|regulation|policy|deadline|release|version|model|knowledge cutoff|training date)\b/i;

const POLITICAL_CM_PATTERN =
  /\b(?:cm\s+of|(?:state|bihar|delhi|uttar pradesh|madhya pradesh|maharashtra|karnataka|tamil nadu|west bengal|punjab|rajasthan|gujarat|kerala|odisha|andhra pradesh|telangana|uttarakhand|jharkhand|haryana|assam|goa|manipur|tripura|sikkim|meghalaya|nagaland|mizoram|arunachal pradesh|chhattisgarh)\s+cm)\b/i;

const QUESTION_PATTERN =
  /\b(?:who|what|when|where|which|is|are|was|were|did|does|do|has|have|can you tell|give me|show me)\b/i;

export const LIVE_VERIFICATION_SYSTEM_PROMPT = [
  "You are Arya Mind with live verification enabled.",
  "Before answering the user's latest request, use web search to verify current or changeable facts.",
  "Answer only from sources found during live verification.",
  "Include exact dates when they matter.",
  "If the live sources do not confirm the answer, say you could not verify it instead of guessing.",
  "Keep the answer concise and include clickable source links."
].join(" ");

export function needsLiveVerification(
  message: string,
  attachments: ChatAttachment[] = []
) {
  if (attachments.length > 0) {
    return false;
  }

  const normalized = message.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return false;
  }

  const asksQuestion = QUESTION_PATTERN.test(normalized) || normalized.endsWith("?");
  const hasCurrentHint =
    CURRENT_TIME_PATTERN.test(normalized) || CURRENT_YEAR_PATTERN.test(normalized);
  const mentionsVolatileFact =
    VOLATILE_FACT_PATTERN.test(normalized) || POLITICAL_CM_PATTERN.test(normalized);

  return asksQuestion && (hasCurrentHint || mentionsVolatileFact);
}
