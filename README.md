# Aion Mind

Aion Mind is a clean AI chat dashboard with branded model choices only:

- Aion Mind
- Aion Mind Pro
- Aion Mind Analyzer

Real provider and model names stay server-side. The UI only shows Aion Mind branding unless you explicitly enable local debug mode.

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

Aion Mind does not store user data inside Gemini, GPT, Claude, Grok, or any other LLM model. Instead, signed-in chats are saved in your PostgreSQL database, and the server searches prior saved messages before each new provider request. Relevant snippets are injected as hidden context, so any configured provider can answer with the right workspace memory when it is useful.

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

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
ANTHROPIC_OPUS_MODEL=

GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_FALLBACK_MODELS=

GROK_API_KEY=
GROK_MODEL=

AION_PROVIDER_TIMEOUT_MS=25000
AION_PROVIDER_MAX_RETRIES=2
AION_PROVIDER_RETRY_BASE_MS=1000
AION_PROVIDER_RETRY_MAX_MS=8000
```

Where each key goes:

- `GEMINI_API_KEY` and `GEMINI_MODEL`: required for the default Aion Mind tab and also used as the Gemini candidate for Analyzer.
- `GEMINI_FALLBACK_MODELS`: optional comma-separated Gemini model IDs to try if the primary Gemini model is quota-blocked or unavailable.
- `OPENAI_API_KEY`: key used by the GPT candidate in Pro/Analyzer.
- `OPENAI_MODEL`: base GPT model ID for Pro/Analyzer.
- `OPENAI_ADVANCED_MODEL`: optional advanced GPT model ID for Analyzer.
- `ANTHROPIC_API_KEY`: key used by Aion Mind Pro, Analyzer, and the Analyzer judge.
- `ANTHROPIC_MODEL`: Claude model ID used by Pro/Analyzer and as the judge model.
- `ANTHROPIC_OPUS_MODEL`: optional Opus model ID for the Analyzer pipeline.
- `GROK_API_KEY` and `GROK_MODEL`: optional Grok candidate for Analyzer.

Missing provider keys are skipped gracefully. At least one configured provider is needed for a useful response, and Claude/Anthropic is needed for the Analyzer judge step.

Provider calls retry transient failures and HTTP 429 rate limits with exponential backoff. The default is two retries, starting around one second and capped at eight seconds. If you are hitting daily quota, retries will still fail until the provider resets or the quota is raised.

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

Leave both as `false` for normal use so users only see Aion Mind brand names.

## Analyzer Workflow

`Aion Mind Analyzer` sends the user request to all configured candidates in parallel, then asks the Claude-backed judge to evaluate correctness, completeness, clarity, confidence, safety, and usefulness. The final response is a single polished answer for the user.

The judge system prompt lives in `services/aionAnalyzer.ts`.
