// Generates a PowerPoint (.pptx) summary of the Aria Mind pricing / provider
// cost sheet. Run with:  node scripts/build-pricing-pptx.mjs
import pptxgen from "pptxgenjs";

const BG = "0B0F17";
const CARD = "121A26";
const ACCENT = "7C6CF6"; // indigo
const ACCENT2 = "34D399"; // green
const TEXT = "F4F4F5";
const MUTED = "9AA3B5";
const HEAD = "1B2433";

const pptx = new pptxgen();
pptx.author = "AriamindX";
pptx.company = "JB Crownstone";
pptx.title = "AriamindX Pricing & Provider Cost Sheet";
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in

function slide() {
  const s = pptx.addSlide();
  s.background = { color: BG };
  return s;
}

function heading(s, text, sub) {
  s.addText(text, { x: 0.6, y: 0.4, w: 12.1, h: 0.6, fontSize: 26, bold: true, color: TEXT, fontFace: "Segoe UI" });
  if (sub) {
    s.addText(sub, { x: 0.6, y: 1.0, w: 12.1, h: 0.4, fontSize: 13, color: MUTED, fontFace: "Segoe UI" });
  }
}

function table(s, rows, opts = {}) {
  const header = rows[0].map((cell) => ({
    text: String(cell),
    options: { bold: true, color: "FFFFFF", fill: { color: HEAD }, fontSize: 11 }
  }));
  const body = rows.slice(1).map((row, ri) =>
    row.map((cell) => ({
      text: String(cell),
      options: { color: TEXT, fill: { color: ri % 2 ? CARD : "0F1722" }, fontSize: 11 }
    }))
  );

  s.addTable([header, ...body], {
    x: 0.6,
    y: 1.6,
    w: 12.1,
    border: { type: "solid", color: "263241", pt: 0.5 },
    align: "left",
    valign: "middle",
    fontFace: "Segoe UI",
    autoPage: false,
    ...opts
  });
}

/* 1. Title */
const t = slide();
t.addText("AriamindX", { x: 0.6, y: 2.1, w: 12, h: 0.7, fontSize: 40, bold: true, color: ACCENT, fontFace: "Segoe UI" });
t.addText("Pricing, Credits & Provider Cost Sheet", {
  x: 0.6, y: 2.9, w: 12, h: 0.6, fontSize: 24, color: TEXT, fontFace: "Segoe UI"
});
t.addText("2x profit on provider cost  ·  user charge = provider cost x 3.0  ·  1 credit = $0.01", {
  x: 0.6, y: 3.6, w: 12, h: 0.5, fontSize: 14, color: MUTED, fontFace: "Segoe UI"
});
t.addText("By JB Crownstone · reviewed 2026-06-09 · Sarvam AI rows are placeholders", {
  x: 0.6, y: 6.7, w: 12, h: 0.4, fontSize: 11, color: MUTED, italic: true, fontFace: "Segoe UI"
});

/* 2. Subscription plans */
const p = slide();
heading(p, "Subscription plans", "Credits map directly to dollars; margins preserve the 3.0x model.");
table(p, [
  ["Plan", "Monthly price", "Monthly credits", "Max safe provider cost", "Gross profit"],
  ["Free", "$0", "50", "$0.17 (marketing)", "Negative by design"],
  ["Starter", "$12", "1,200", "$4.00", "$8.00"],
  ["Plus", "$29", "2,900", "$9.67", "$19.33"],
  ["Pro", "$79", "7,900", "$26.33", "$52.67"],
  ["Studio", "$199", "19,900", "$66.33", "$132.67"]
], { colW: [2.0, 2.2, 2.6, 3.1, 2.2], rowH: 0.5 });

/* 3. Provider rates (incl. Sarvam) */
const r = slide();
heading(r, "Provider API rates (USD)", "Text models, per 1M tokens. Sarvam AI = India, placeholder rates.");
table(r, [
  ["Provider", "Model", "Input / 1M", "Output / 1M"],
  ["OpenAI", "GPT-5.5", "$5.00", "$30.00"],
  ["OpenAI", "GPT-5.4 mini", "$0.75", "$4.50"],
  ["Anthropic", "Claude Opus 4.8", "$5.00", "$25.00"],
  ["Anthropic", "Claude Sonnet 4.6", "$3.00", "$15.00"],
  ["Gemini", "Gemini 3.1 Pro", "$2.00", "$12.00"],
  ["DeepSeek", "V4 Pro", "$0.435", "$0.87"],
  ["xAI", "Grok 4.3", "$1.25", "$2.50"],
  ["Sarvam AI (IN)", "Sarvam-M  *placeholder", "$0.50", "$2.00"],
  ["Sarvam AI (IN)", "Sarvam-2B  *placeholder", "$0.20", "$0.60"]
], { colW: [2.6, 4.0, 2.75, 2.75], rowH: 0.42, y: 1.5 });

/* 4. Text cost → credits (3.0x) */
const c = slide();
heading(c, "Text cost → credits (3.0x)", "Assumes 3,000 input + 1,000 output tokens, no cache/tools.");
table(c, [
  ["Provider / model", "Provider cost", "Min @ 3.0x", "Recommended"],
  ["OpenAI GPT-5.5", "$0.045000", "14 credits", "15 credits"],
  ["Claude Opus 4.8", "$0.040000", "12 credits", "15 credits"],
  ["Gemini 3.5 Flash", "$0.013500", "5 credits", "6 credits"],
  ["GPT-5.4 mini", "$0.006750", "3 credits", "5 credits"],
  ["Sarvam-M (IN) *placeholder", "$0.003500", "2 credits", "3 credits"],
  ["DeepSeek V4 Pro", "$0.002175", "1 credit", "3 credits"],
  ["Sarvam-2B (IN) *placeholder", "$0.001200", "1 credit", "2 credits"]
], { colW: [4.6, 2.7, 2.4, 2.4], rowH: 0.45, y: 1.5 });

/* 5. Public feature prices */
const f = slide();
heading(f, "Public feature prices", "Shown in-app once credit tracking is live. '+' = meter and add more.");
table(f, [
  ["User action", "Credits", "User action", "Credits"],
  ["Aria Mind short message", "6", "Standard 1K image", "25"],
  ["Aria Mind normal message", "15", "2K image", "35"],
  ["Aria Mind long message", "30+", "4K image", "50"],
  ["Attachment / file analysis", "50+", "Video", "150+ (quoted)"],
  ["Live web search", "+3", "TTS (1K chars)", "20"],
  ["Aria Research answer", "3-15+", "Speech-to-text (hr)", "75"],
  ["Aria Analyzer answer", "70+", "Voice agent (min)", "30"]
], { colW: [4.0, 2.0, 4.1, 2.0], rowH: 0.45, y: 1.5 });

/* 6. Implementation rules */
const i = slide();
heading(i, "Implementation rules");
const rules = [
  "No unlimited AI — credits gate every route.",
  "Reserve credits before the provider call; capture exact cost after.",
  "Charge max(product minimum, actual provider cost x 3.0).",
  "Research charges the selected engine; Analyzer charges all candidates + live search + judge.",
  "Web search, tools, attachments, video, voice, dubbing are additive.",
  "Runware/ElevenLabs: quote from returned cost / characters before generating.",
  "Stop the request if balance is below the reservation.",
  "Daily per-user spend caps + provider kill switches.",
  "Replace Sarvam placeholder rates with official figures before publishing."
];
i.addText(
  rules.map((r) => ({ text: r, options: { bullet: { code: "2022" }, color: TEXT, fontSize: 15, paraSpaceAfter: 10 } })),
  { x: 0.7, y: 1.5, w: 12, h: 5.4, fontFace: "Segoe UI" }
);

await pptx.writeFile({ fileName: "USER_SUBSCRIPTION_PRICES_2.pptx" });
console.log("Wrote USER_SUBSCRIPTION_PRICES_2.pptx");
