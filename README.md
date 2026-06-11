# Aria Mind

Aria Mind is a clean AI chat dashboard with branded model choices only:

- Aria Mind
- Aria Research
- Aria Analyzer

Real provider and model names stay server-side. The UI only shows Aria Mind branding unless you explicitly enable local debug mode.

## Login and PostgreSQL chat sync

Chats are now saved server-side when a user is signed in. Add PostgreSQL settings to `.env`, then restart the dev server.

Connection string option:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/aion_mind
DATABASE_SSL=false
```

Split variable option, recommended when the database password contains characters like `#`, `&`, `^`, `@`, or `*`:

```env
AION_PG_HOST=aws-1-ap-southeast-2.pooler.supabase.com
AION_PG_PORT=5432
AION_PG_DATABASE=postgres
AION_PG_USER=postgres.your-project-ref
AION_PG_PASSWORD=your-password
AION_PG_SSL=true
```

If the split values are complete, they are used before `DATABASE_URL`. The app also accepts the same `JBTALLY_PG_*` names for compatibility with existing Supabase-style env blocks. Use SSL for hosted databases that require it. The app creates the required auth/session/chat tables automatically on first database access.

## Workspace memory and retrieval

Aria Mind does not store user data inside Gemini, GPT, Claude, Grok, or any other LLM model. Instead, signed-in chats are saved in your PostgreSQL database, and the server searches prior saved messages before each new provider request. Relevant snippets are injected as hidden context, so any configured provider can answer with the right workspace memory when it is useful.

Temporary chats are excluded from memory retrieval.

## Folder Structure

```text
app/
  api/chat/route.ts        # Server-side chat API route
  globals.css              # Dashboard styling
  layout.tsx
  page.tsx
components/
  ChatDashboard.tsx        # Main responsive chat UI
  MarkdownMessage.tsx      # Markdown renderer
providers/
  openaiProvider.ts
  claudeProvider.ts
  geminiProvider.ts
  grokProvider.ts
services/
  aionAnalyzer.ts          # Multi-provider analyzer and judge prompt
  modelRouter.ts           # Branded model routing
types/
  aion.ts                  # Shared request/response types
```

## Setup

1. Install dependencies:

```bash
npm install
```

On Windows PowerShell, if `npm` is blocked by execution policy, use:

```powershell
npm.cmd install
```

2. Create your local environment file:

```powershell
Copy-Item .env.example .env.local
```

3. Put your API keys and model IDs in `.env.local`.

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
OPENAI_ADVANCED_MODEL=
OPENAI_JUDGE_MODEL=gpt-5.5
OPENAI_LIVE_MODEL=gpt-5.5
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_MODEL_PRO=gpt-image-1

TAVILY_API_KEY=
TAVILY_SEARCH_DEPTH=basic
TAVILY_MAX_RESULTS=6

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
ANTHROPIC_OPUS_MODEL=

DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-pro

GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_RESEARCH_MODEL=gemini-3.1
GEMINI_FALLBACK_MODELS=
GEMINI_IMAGE_MODEL_DEFAULT=gemini-3.1-flash-image
GEMINI_IMAGE_MODEL_PRO=gemini-3-pro-image
GEMINI_VIDEO_MODEL_LITE=veo-3.1-fast-generate-preview
GEMINI_VIDEO_MODEL_FAST=veo-3.1-fast-generate-preview
GEMINI_VIDEO_MODEL_PRO=veo-3.1-generate-preview

GROK_API_KEY=
GROK_MODEL=

RUNWARE_API_KEY=
RUNWARE_IMAGE_MODEL_DEFAULT=runware:100@1
RUNWARE_IMAGE_MODEL_PRO=runware:400@1
RUNWARE_VIDEO_MODEL_DEFAULT=prunaai:p-video@0
RUNWARE_VIDEO_MODEL_PRO=klingai:kling-video@3-pro

AION_PROVIDER_TIMEOUT_MS=25000
AION_PROVIDER_MAX_RETRIES=2
AION_PROVIDER_RETRY_BASE_MS=1000
AION_PROVIDER_RETRY_MAX_MS=8000
AION_PROMPT_ENHANCE_TIMEOUT_MS=12000
AION_LIVE_VERIFICATION_TIMEOUT_MS=35000
AION_IMAGE_TIMEOUT_MS=60000
GEMINI_IMAGE_TIMEOUT_MS=90000
GEMINI_VIDEO_TIMEOUT_MS=60000
GEMINI_VIDEO_STATUS_TIMEOUT_MS=45000
GEMINI_VIDEO_DOWNLOAD_TIMEOUT_MS=90000
RUNWARE_IMAGE_TIMEOUT_MS=60000
RUNWARE_VIDEO_TIMEOUT_MS=60000
RUNWARE_VIDEO_STATUS_TIMEOUT_MS=30000
```

Where each key goes:

- `OPENAI_MODEL`: default instant model for Aria Mind. The recommended default is `gpt-5.4-mini`.
- `GEMINI_FALLBACK_MODELS`: optional comma-separated Gemini model IDs to try if the primary Gemini model is quota-blocked or unavailable.
- `GEMINI_API_KEY` and `GEMINI_MODEL`: used when Gemini is selected in Aria Research or participates in Aria Analyzer.
- `GEMINI_RESEARCH_MODEL`: Gemini model ID used for the Research and Analyzer Gemini slot. Defaults to `gemini-3.1`.
- `GEMINI_IMAGE_MODEL_DEFAULT`: Google image model used by the Images page `Google / Nano Banana 2` option. Defaults to `gemini-3.1-flash-image`.
- `GEMINI_IMAGE_MODEL_PRO`: optional Google image model used by the Images page `Google / Nano Banana Pro` option. Defaults to `gemini-3-pro-image`.
- `GEMINI_VIDEO_MODEL_LITE`: Google Veo model used by the Videos page `Google Veo / Veo 3.1 Lite` option. Defaults to `veo-3.1-fast-generate-preview`.
- `GEMINI_VIDEO_MODEL_FAST`: Google Veo model used by the Videos page `Google Veo / Veo 3.1 Fast` option. Defaults to `veo-3.1-fast-generate-preview`.
- `GEMINI_VIDEO_MODEL_PRO`: Google Veo model used by the Videos page `Google Veo / Veo 3.1 Standard` option. Defaults to `veo-3.1-generate-preview`.
- `OPENAI_API_KEY`: key used by Aria Mind, the GPT-5.5 Research/Analyzer slot, OpenAI live verification, and the Analyzer judge.
- `OPENAI_ADVANCED_MODEL`: optional GPT model ID for the GPT-5.5 Research/Analyzer slot.
- `OPENAI_JUDGE_MODEL`: OpenAI model ID used by the Aria Analyzer judge. The app defaults to `gpt-5.5`.
- `OPENAI_LIVE_MODEL`: optional OpenAI model ID used for Aria Mind/Analyzer live web verification of current facts. Defaults to `OPENAI_JUDGE_MODEL`, then `gpt-5.5`.
- `TAVILY_API_KEY`: search-only key used by Aria Research to find current web pages before the selected research engine writes the answer.
- `TAVILY_SEARCH_DEPTH`: optional Tavily search depth. Defaults to `basic`.
- `TAVILY_MAX_RESULTS`: optional maximum Tavily results to pass into the selected research engine. Defaults to `6`.
- `AION_PROMPT_ENHANCE_TIMEOUT_MS`: optional timeout for the chat composer prompt enhancer. Defaults to 12000 ms.
- `OPENAI_IMAGE_MODEL`: OpenAI image model used by the Images page `OpenAI / gpt-image-1` option. Defaults to `gpt-image-1`.
- `OPENAI_IMAGE_MODEL_PRO`: optional OpenAI image model used by the Images page `OpenAI / gpt-image-1 (OPENAI_IMAGE_MODEL_PRO)` option. Falls back to `OPENAI_IMAGE_MODEL`.
- `RUNWARE_API_KEY`: key used by the Images and Videos pages when `Runware` is selected.
- `RUNWARE_IMAGE_MODEL_DEFAULT`: Runware model used by `Runware / FLUX Schnell`. Defaults to `runware:100@1`.
- `RUNWARE_IMAGE_MODEL_PRO`: Runware model used by `Runware / runware:400@1`. Defaults to `runware:400@1`.
- `RUNWARE_VIDEO_MODEL_DEFAULT`: Runware video model used by the Videos page `prunaai:p-video@0` option. Defaults to `prunaai:p-video@0`.
- `RUNWARE_VIDEO_MODEL_PRO`: Runware video model used by the Videos page `klingai:kling-video@3-pro` option. Defaults to `klingai:kling-video@3-pro`.
- `ANTHROPIC_API_KEY`: key used by the Opus-4.8 Research/Analyzer slot.
- `ANTHROPIC_MODEL`: optional Claude model ID.
- `ANTHROPIC_OPUS_MODEL`: optional Opus model ID for Research and Analyzer.
- `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL`: key and model used by the DeepSeek Research/Analyzer slot. The recommended default is `deepseek-v4-pro`.
- `GROK_API_KEY` and `GROK_MODEL`: optional Grok routing values if enabled in Model Routing.

Missing provider keys are skipped gracefully. At least one configured provider is needed for a useful response, and OpenAI is used for the Analyzer judge step. If the judge is unavailable, Aria Mind falls back to a successful candidate response.

Provider calls retry transient failures and HTTP 429 rate limits with exponential backoff. The default is two retries, starting around one second and capped at eight seconds. If you are hitting daily quota, retries will still fail until the provider resets or the quota is raised.

The Images page can generate prompt-based images through OpenAI, Runware, or Google Nano Banana. Generated image bytes are exposed through `/api/images/:imageId` and saved locally under `data/generated-images/` when base64 image data is available, so new Library image URLs survive dev-server restarts.

The Videos page supports Runware and Google Veo for text-to-video and image-to-video. The app starts a provider job, stores the provider task/operation ID in server memory, and polls `/api/videos/:jobId/status` until the generated MP4 URL is ready.

Current or changeable factual questions, such as office holders, prices, scores, weather, elections, releases, regulations, or recent news, use live web context before the model answers. Aria Research uses Tavily as a search-only tool, then passes the source snippets into the selected research engine, such as DeepSeek or Opus-4.8, for the final answer. If live search cannot return verifiable sources in the live-enabled tiers, Aria Mind tells the user it could not verify instead of falling back to a guessed model-memory answer.

4. Run locally:

```bash
npm run dev
```

PowerShell fallback:

```powershell
npm.cmd run dev
```

Open `http://localhost:3000` in VS Code or your browser.

## Debug Mode

Debug mode is off by default. To show internal routing diagnostics in the UI, set both of these in `.env.local`:

```env
AION_DEBUG=true
NEXT_PUBLIC_AION_DEBUG=true
```

Leave both as `false` for normal use so users only see Aria Mind brand names.

## Aria Tiers

- `Aria Mind` uses the `gpt-5.4-mini` instant route for fast everyday answers and adds live-search context when the request needs current facts.
- `Aria Research` opens a model picker. The user chooses GPT-5.5, Opus-4.8, DeepSeek, or Gemini-3.1. For current facts, Tavily finds pages first, then only the selected engine writes the research response from those sources.
- `Aria Analyzer` sends the user request to GPT-5.5, Opus-4.8, DeepSeek, and Gemini-3.1 candidates with live-search context, then the GPT-5.5 `Aria Analyzer` judge synthesizes one final answer.

The judge system prompt lives in `services/aionAnalyzer.ts`.

## Model routing GUI

Use the slider button beside the `Aria Mind / Aria Research / Aria Analyzer` selector to open Model Routing. The drawer lets signed-in users choose provider, model ID, enabled state, and temperature for each Mind, Research, Analyzer, and judge slot.

API keys still live in `.env`. Saved routing choices are stored locally in `data/aion-routing.json`, which is ignored by git.
