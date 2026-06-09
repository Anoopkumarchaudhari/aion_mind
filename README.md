# Arya Mind

Arya Mind is a clean AI chat dashboard with branded model choices only:

- Arya Mind
- Arya Mind Pro
- Arya Mind Analyzer

Real provider and model names stay server-side. The UI only shows Arya Mind branding unless you explicitly enable local debug mode.

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

Arya Mind does not store user data inside Gemini, GPT, Claude, Grok, or any other LLM model. Instead, signed-in chats are saved in your PostgreSQL database, and the server searches prior saved messages before each new provider request. Relevant snippets are injected as hidden context, so any configured provider can answer with the right workspace memory when it is useful.

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
OPENAI_MODEL=
OPENAI_ADVANCED_MODEL=
OPENAI_JUDGE_MODEL=gpt-5.5
OPENAI_LIVE_MODEL=gpt-5.5
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_MODEL_PRO=gpt-image-1

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
ANTHROPIC_OPUS_MODEL=

DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-pro

GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_FALLBACK_MODELS=

GROK_API_KEY=
GROK_MODEL=

RUNWARE_API_KEY=
RUNWARE_IMAGE_MODEL_DEFAULT=runware:100@1
RUNWARE_IMAGE_MODEL_PRO=runware:400@1

AION_PROVIDER_TIMEOUT_MS=25000
AION_PROVIDER_MAX_RETRIES=2
AION_PROVIDER_RETRY_BASE_MS=1000
AION_PROVIDER_RETRY_MAX_MS=8000
AION_LIVE_VERIFICATION_TIMEOUT_MS=35000
AION_IMAGE_TIMEOUT_MS=60000
RUNWARE_IMAGE_TIMEOUT_MS=60000
```

Where each key goes:

- `GEMINI_API_KEY` and `GEMINI_MODEL`: required for the default Arya Mind tab and also used as the Gemini candidate for Analyzer.
- `GEMINI_FALLBACK_MODELS`: optional comma-separated Gemini model IDs to try if the primary Gemini model is quota-blocked or unavailable.
- `OPENAI_API_KEY`: key used by the GPT candidate in Pro/Analyzer and by the Analyzer judge.
- `OPENAI_MODEL`: base GPT model ID for Pro/Analyzer.
- `OPENAI_ADVANCED_MODEL`: optional advanced GPT model ID for Analyzer.
- `OPENAI_JUDGE_MODEL`: OpenAI model ID used by the Analyzer judge. The app defaults to `gpt-5.5`.
- `OPENAI_LIVE_MODEL`: optional OpenAI model ID used for live web verification of current facts. Defaults to `OPENAI_JUDGE_MODEL`, then `gpt-5.5`.
- `OPENAI_IMAGE_MODEL`: OpenAI image model used by the Images page `OpenAI / Default` option. Defaults to `gpt-image-1`.
- `OPENAI_IMAGE_MODEL_PRO`: optional OpenAI image model used by the Images page `OpenAI / Pro` option. Falls back to `OPENAI_IMAGE_MODEL`.
- `RUNWARE_API_KEY`: key used by the Images page when `Runware` is selected.
- `RUNWARE_IMAGE_MODEL_DEFAULT`: Runware model used by `Runware / FLUX Schnell`. Defaults to `runware:100@1`.
- `RUNWARE_IMAGE_MODEL_PRO`: Runware model used by `Runware / Pro`. Defaults to `runware:400@1`.
- `ANTHROPIC_API_KEY`: key used by Arya Mind Pro and Analyzer.
- `ANTHROPIC_MODEL`: Claude model ID used by Pro/Analyzer.
- `ANTHROPIC_OPUS_MODEL`: optional Opus model ID for the Analyzer pipeline.
- `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL`: optional DeepSeek candidate for Analyzer. The recommended Analyzer default is `deepseek-v4-pro`.
- `GROK_API_KEY` and `GROK_MODEL`: optional Grok candidate for Analyzer.

Missing provider keys are skipped gracefully. At least one configured provider is needed for a useful response, and OpenAI is used for the Analyzer judge step. If the judge is unavailable, Arya Mind falls back to a successful candidate response.

Provider calls retry transient failures and HTTP 429 rate limits with exponential backoff. The default is two retries, starting around one second and capped at eight seconds. If you are hitting daily quota, retries will still fail until the provider resets or the quota is raised.

The Images page uses the same `OPENAI_API_KEY` to generate prompt-based images. Generated image bytes are kept in server memory and exposed through `/api/images/:imageId`, so saved Library entries stay small.

Current or changeable factual questions, such as office holders, prices, scores, weather, elections, releases, regulations, or recent news, are routed through OpenAI live web verification before the model answers. If live search cannot return verifiable sources, Arya Mind tells the user it could not verify instead of falling back to a guessed model-memory answer.

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

Leave both as `false` for normal use so users only see Arya Mind brand names.

## Analyzer Workflow

`Arya Mind Analyzer` sends the user request to Claude Opus, DeepSeek, and GPT-5.5 in parallel, shows each candidate answer, then asks the OpenAI-backed judge to evaluate correctness, completeness, clarity, confidence, safety, and usefulness. The final section is labeled `Judge answer`.

The judge system prompt lives in `services/aionAnalyzer.ts`.

## Model routing GUI

Use the slider button beside the `Arya / Pro / Analyser` selector to open Model Routing. The drawer lets signed-in users choose provider, model ID, enabled state, and temperature for each Arya, Pro, Analyzer, and judge slot.

API keys still live in `.env`. Saved routing choices are stored locally in `data/aion-routing.json`, which is ignored by git.
