# Aria Mind Pricing and Credits Guide

Last reviewed: 2026-06-09

This document explains how Aria Mind should price user-facing features, track provider costs, and manage user credits as more APIs are added later, including ElevenLabs and Google AI Studio/Gemini.

Provider prices change often. Treat this file as the product and engineering model, not a permanent price list. The app should store provider prices in database price cards with `source_url` and `verified_at`, then refresh them before launch or whenever a provider changes rates.

## Current App Structure

Aria Mind is a Next.js app with authenticated API routes and server-side provider calls.

Pricing-relevant areas:

| Area | Files | Current behavior |
| --- | --- | --- |
| Auth and users | `services/auth.ts`, `services/db.ts` | Requires signed-in users for chat, image, and video routes. Uses PostgreSQL through `services/db.ts`. |
| Chat API | `app/api/chat/route.ts` | Validates request, builds memory context, and streams through `services/streamRouter.ts`. |
| Model routing | `services/aionRoutingConfig.ts`, `services/aionModelCalls.ts`, `services/streamRouter.ts` | Supports Aria Mind, Aria Research, and Aria Analyzer. |
| Providers | `providers/*Provider.ts` | Calls OpenAI, Anthropic, DeepSeek, Gemini, and Grok. Current provider responses do not expose token usage. |
| Images | `app/api/images/generate/route.ts` | Uses OpenAI or Runware image generation. Cost is not currently captured for images. |
| Videos | `app/api/videos/generate/route.ts`, `app/api/videos/[jobId]/status/route.ts`, `services/runwareVideo.ts` | Uses Runware video generation. `includeCost: true` is already used for video tasks and `VideoJob.cost` can store provider cost. |
| Billing UI | `components/SettingsPageContent.tsx` | Billing tab is only placeholder content today. |

Important pricing detail: one user-visible chat request can create multiple provider calls.

- `aion-mind`: normally one `gpt-5.4-mini` model call. Live verification can add another OpenAI call when current facts are needed.
- `aion-mind-pro`: Aria Research. The user selects one engine from GPT-5.5, Opus-4.8, DeepSeek, or Gemini-3.1; only that selected engine handles the research response.
- `aion-mind-analyzer`: Aria Analyzer. Four candidate calls run in parallel, then a GPT-5.5 judge synthesizes one final answer.

Because of this, billing should charge from the total internal provider cost of the full request, not from the selected UI model name alone.

## Terminology

Use these words consistently:

- **Provider tokens**: OpenAI/Anthropic/Gemini/DeepSeek/Grok input, cached input, output, reasoning, audio, image, or document tokens.
- **Aria credits**: user-facing balance used inside this app.
- **Provider cost**: actual vendor cost in USD before Aria markup.
- **Billable cost**: provider cost plus Aria markup, platform fee, and minimum charge.
- **Reservation**: temporary credit hold before calling an external provider.
- **Capture**: final credit deduction after actual usage is known.
- **Release**: return unused reserved credits.

Do not call user credits "tokens" in the UI. Tokens are provider metering units. Credits are the user's wallet balance.

## Recommended Credit Unit

Use an internal integer balance to avoid floating point errors.

Recommended user-facing value:

```text
1 Aria credit = $0.01 of user-facing value
1 credit_micro = 0.000001 Aria credit
1 USD micro = $0.000001
```

Examples:

```text
$10 credit pack = 1,000 Aria credits
$25 credit pack = 2,500 Aria credits
$100 credit pack = 10,000 Aria credits
```

Store balances as `BIGINT` credit micros:

```text
1000 credits = 1,000,000,000 credit_micros
```

This lets the backend settle exact fractional costs while the UI can display rounded credits.

## Pricing Formula

Each provider call should produce a normalized usage record. Then calculate:

```text
provider_cost_usd =
  input_tokens / 1_000_000 * input_usd_per_mtok
+ cached_input_tokens / 1_000_000 * cached_input_usd_per_mtok
+ output_tokens / 1_000_000 * output_usd_per_mtok
+ reasoning_tokens / 1_000_000 * reasoning_usd_per_mtok
+ images * image_usd
+ video_seconds * video_second_usd
+ audio_seconds / 60 * audio_minute_usd
+ characters / 1000 * character_usd_per_1k
+ tool_fees_usd
+ provider_reported_cost_usd
```

Then calculate user charge:

```text
billable_usd = max(
  feature_minimum_usd,
  provider_cost_usd * markup_multiplier + platform_fee_usd
)

credits_charged = ceil_to_increment(
  billable_usd / 0.01,
  feature_credit_rounding_increment
)
```

Recommended starting policy:

| Feature | Minimum charge | Rounding | Notes |
| --- | ---: | ---: | --- |
| Aria Mind chat | 1 credit | 0.1 credit | One normal model call, but live verification can add cost. |
| Aria Research chat | selected-model quote | 0.5 credit | One selected research engine. |
| Aria Analyzer | 8 credits | 1 credit | Highest-cost text route because it runs four candidates plus a judge. |
| Image default | quote before generation | 1 credit | Use price card or provider returned cost. |
| Image pro | quote before generation | 1 credit | Higher model/quality/aspect choices should cost more. |
| Video default/pro | quote before generation | 1 credit | Reserve by duration and model, then settle actual Runware `cost`. |
| Future TTS | quote from characters | 0.1 credit | ElevenLabs is character/credit driven. |
| Future STT/audio | quote from seconds/minutes | 0.1 credit | Depends on provider unit. |

Recommended markup:

```text
development/testing: 1.2x to 2.0x
public beta: 2.0x to 4.0x
production: 3.0x to 6.0x, adjusted by refunds, payment fees, support, taxes, and failed-job risk
```

Keep markup configurable per feature. Do not use one markup for chat, images, video, and voice. Video and voice have different refund and abuse risks than text chat.

## User Plans

Start with simple plans and make credits the single meter across all AI features.

| Plan | Included credits | Access | Overage |
| --- | ---: | --- | --- |
| Free | Small monthly grant | Aria Mind chat, limited image trials | No overage. Ask user to upgrade. |
| Plus | Monthly credit grant | Aria Mind, images, limited Research | Buy extra packs. |
| Pro | Larger monthly grant | Aria Research, Analyzer, higher image/video limits | Buy extra packs. |
| Studio | Large monthly grant | Heavy image/video/voice workflows | Volume discount or custom pricing. |

Rules:

- Monthly plan credits expire at period end unless you intentionally offer rollover.
- Purchased credits should not expire unless local law and product policy allow it.
- Promotional credits should expire and should be consumed before paid credits.
- Show users an estimated credit price before expensive actions like image, video, and long audio.
- For chat, show the selected mode's typical range, for example "Usually 1-3 credits", and show exact cost in usage history after completion.

## Request Lifecycle

Every expensive route should follow this lifecycle.

1. Authenticate user.
2. Create a `request_id`.
3. Estimate maximum charge from selected feature, model, prompt length, duration, quality, and expected output cap.
4. Reserve credits inside a database transaction.
5. Call provider.
6. Normalize provider usage and provider-reported cost.
7. Capture final credits.
8. Release unused reservation.
9. Persist a usage event and expose updated balance.
10. If provider failed and no vendor cost was incurred, release the full reservation.

Streaming chat needs a final settlement step when the stream closes. If a provider can return streaming usage, parse it. If not, estimate with a tokenizer or response length fallback and flag the usage event as estimated.

## Ledger Tables

Add tables to `services/db.ts` first, or use Prisma migrations when the app moves to formal migrations.

Use append-only transactions. Never update a previous transaction amount. Add a correcting transaction instead.

```sql
CREATE TABLE IF NOT EXISTS credit_accounts (
  user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  balance_credit_micros BIGINT NOT NULL DEFAULT 0,
  lifetime_purchased_credit_micros BIGINT NOT NULL DEFAULT 0,
  lifetime_granted_credit_micros BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  request_id TEXT,
  type TEXT NOT NULL,
  amount_credit_micros BIGINT NOT NULL,
  balance_after_credit_micros BIGINT NOT NULL,
  feature TEXT,
  description TEXT,
  metadata JSONB,
  created_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_request_type
ON credit_transactions(request_id, type)
WHERE request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  selected_model TEXT,
  provider TEXT,
  provider_model TEXT,
  status TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  characters INTEGER NOT NULL DEFAULT 0,
  audio_seconds INTEGER NOT NULL DEFAULT 0,
  image_count INTEGER NOT NULL DEFAULT 0,
  video_seconds INTEGER NOT NULL DEFAULT 0,
  provider_cost_usd_micros BIGINT NOT NULL DEFAULT 0,
  charged_credit_micros BIGINT NOT NULL DEFAULT 0,
  estimated BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_created
ON usage_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS price_cards (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  feature TEXT NOT NULL,
  unit TEXT NOT NULL,
  input_usd_per_mtok NUMERIC(12, 6),
  cached_input_usd_per_mtok NUMERIC(12, 6),
  output_usd_per_mtok NUMERIC(12, 6),
  reasoning_usd_per_mtok NUMERIC(12, 6),
  image_usd NUMERIC(12, 6),
  video_second_usd NUMERIC(12, 6),
  audio_minute_usd NUMERIC(12, 6),
  character_usd_per_1k NUMERIC(12, 6),
  fixed_request_usd NUMERIC(12, 6),
  source_url TEXT NOT NULL,
  verified_at BIGINT NOT NULL,
  effective_from BIGINT NOT NULL,
  effective_to BIGINT
);
```

Transaction `type` values:

```text
grant
purchase
reserve
capture
release
refund
adjustment
expire
```

Use negative amounts for deductions and positive amounts for grants, purchases, releases, and refunds.

## Provider Usage Shape

Extend `ProviderResponse` and `ProviderStreamResponse` in `services/types.ts`:

```ts
export type ProviderUsage = {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  characters?: number;
  audioSeconds?: number;
  imageCount?: number;
  videoSeconds?: number;
  providerCostUsd?: number;
  estimated?: boolean;
};

export type ProviderResponse = {
  provider: ProviderName;
  model?: string;
  ok: boolean;
  content?: string;
  usage?: ProviderUsage;
  error?: string;
  skipped?: boolean;
  latencyMs: number;
};
```

Then update each provider adapter to parse native usage:

- OpenAI chat/responses/image usage, including cached input when returned.
- Anthropic `usage`, including cache reads/writes where used.
- DeepSeek token usage and cache hit/miss pricing.
- Gemini usage metadata by modality.
- Grok/xAI usage and any tool/image/video fees.
- Runware `cost` field, already enabled for video.
- ElevenLabs characters, credits, audio seconds, or subscription credit usage when added.

For Runware images, add `includeCost: true` to image tasks if supported for the chosen task type. If the response returns `cost`, store it as `providerCostUsd`.

## Credit Service API

Create a dedicated service, for example `services/creditLedger.ts`.

Suggested functions:

```ts
type ReserveCreditsInput = {
  userId: string;
  requestId: string;
  feature: string;
  estimatedCreditMicros: bigint;
  metadata?: Record<string, unknown>;
};

type CaptureUsageInput = {
  userId: string;
  requestId: string;
  feature: string;
  usageEvents: NormalizedUsageEvent[];
  finalCreditMicros: bigint;
  metadata?: Record<string, unknown>;
};

export async function getCreditBalance(userId: string): Promise<bigint>;
export async function reserveCredits(input: ReserveCreditsInput): Promise<void>;
export async function captureUsage(input: CaptureUsageInput): Promise<void>;
export async function releaseReservation(userId: string, requestId: string): Promise<void>;
export async function grantMonthlyCredits(userId: string, planId: string): Promise<void>;
```

Implementation requirements:

- Use PostgreSQL transactions.
- Lock the account row with `SELECT ... FOR UPDATE`.
- Make `request_id + transaction type` idempotent.
- Never allow balance to go negative unless an admin explicitly enables postpaid billing.
- Add a cleanup job for stale reservations.

## Route Integration

### Chat

In `app/api/chat/route.ts`:

- Estimate credits from selected model, message length, attachments, history, and live-search likelihood.
- Reserve before calling `routeAionStream`.
- Pass `request_id` into the stream router.
- Collect usage from the selected Research engine or from every Analyzer candidate and judge call.
- Capture on stream close.
- Release on validation/provider failure.

For `aion-mind-pro`, charge for the selected Research engine. For `aion-mind-analyzer`, charge from the sum of all candidate calls, live search, and the judge, not just the final answer.

### Images

In `app/api/images/generate/route.ts`:

- Quote before generation using provider, `modelKey`, aspect ratio, and quality.
- Reserve credits before calling OpenAI or Runware.
- For Runware, prefer provider returned `cost` when available.
- For OpenAI images, use price cards unless the API returns exact usage/cost.
- Capture after `saveGeneratedImage`.

### Videos

In `app/api/videos/generate/route.ts`:

- Quote by provider, model key, mode, duration, and expected resolution.
- Reserve enough credits before `startRunwareVideo`.
- Store `request_id` on the video job.
- Capture when Runware returns final `cost`. If the first response is only queued, capture in `app/api/videos/[jobId]/status/route.ts` when status becomes succeeded and cost is known.
- Release or refund if the job fails and Runware did not charge.

### Future ElevenLabs

Add a separate audio route instead of mixing voice into chat billing first.

Recommended feature names:

```text
tts
voice_clone
speech_to_text
voice_agent
dubbing
sound_effect
```

Billing rules:

- TTS: reserve from input character count and selected voice/model.
- STT: reserve from uploaded audio duration.
- Voice agents: reserve by maximum session minutes, then settle on actual duration/messages.
- Dubbing: quote from media duration and language count.
- Store external ElevenLabs credit usage separately from Aria credits. Do not expose ElevenLabs credits directly to users.

### Future Google AI Studio/Gemini

The app already has `providers/geminiProvider.ts` and `GEMINI_API_KEY`.

Billing rules:

- For Gemini API, charge by token usage and modality from usage metadata.
- For Google AI Studio UI, remember that Studio access can be free for manual use, but production API usage should still go through Aria credits.
- Store Gemini free-tier usage as provider cost zero only if the request is truly covered by the provider's free tier. Still log usage events so abuse limits and plan limits work.

## User-Facing Billing UX

Add these to the Billing tab:

- Current credit balance.
- Monthly included credits and renewal date.
- Purchased credits.
- Recent usage table.
- Filter by Chat, Images, Video, Voice.
- Per-request details: feature, date, credits used, status, and optional provider-neutral explanation.
- Low balance warning.
- Buy credits button.
- Auto top-up toggle if payment provider supports it.

For expensive actions:

- Image/video/audio should show exact estimated credits before the request.
- Chat can show a typical range before sending and exact usage after response.
- If balance is too low, block before provider call.

Keep internal provider routing hidden from normal chat answers. Billing history can stay product-level, for example "Aria Research answer", unless you intentionally want transparent provider details for admins.

## Guardrails

Add hard limits even when the user has credits:

- Max chat request length.
- Max history window sent to provider.
- Max images per hour.
- Max video seconds per day.
- Max voice minutes per day.
- Per-user monthly spend cap.
- Per-workspace daily spend cap.
- Provider-level circuit breaker when vendor spend spikes.
- Admin kill switch for each provider.

Useful environment variables:

```ini
AION_CREDIT_USD_VALUE=0.01
AION_DEFAULT_MARKUP_BPS=40000
AION_CHAT_MIN_CREDITS=1
AION_PRO_MIN_CREDITS=4
AION_ANALYZER_MIN_CREDITS=8
AION_FREE_MONTHLY_CREDITS=100
AION_MAX_DAILY_CREDIT_SPEND=5000
AION_LOW_BALANCE_CREDITS=100
```

`AION_DEFAULT_MARKUP_BPS=40000` means 4.0x because basis points are 1/10000.

## Official Provider Pricing Sources

Check these before publishing prices to users.

| Provider | Official source | Notes for this app |
| --- | --- | --- |
| OpenAI | https://openai.com/api/pricing/ | Text, image, realtime audio, cached input, batch, and regional pricing can differ by model. |
| Anthropic | https://platform.claude.com/docs/en/about-claude/pricing | Includes base input, cache write/read, output, batch, data residency, and tool pricing. |
| DeepSeek | https://api-docs.deepseek.com/quick_start/pricing | Prices are per 1M tokens and distinguish cache hit vs cache miss input. |
| Gemini / Google AI Studio | https://ai.google.dev/gemini-api/docs/pricing | Gemini API has free and paid tiers. Google AI Studio UI access can be free, but production API pricing still needs tracking. |
| xAI / Grok | https://docs.x.ai/developers/pricing | Model access and exact model pricing can vary by console/team. Check model pages. |
| Runware | https://runware.ai/docs/platform/pricing and https://runware.ai/pricing | Use `includeCost` when possible. Runware can return exact USD task cost. |
| ElevenLabs | https://elevenlabs.io/pricing | Uses credits/characters/minutes depending on feature and model. Keep it separate from Aria credits internally. |

Known current facts from official pages on 2026-06-09:

- OpenAI pricing pages list token pricing by model and separate cached input, output, image, realtime, batch, and data residency pricing.
- Anthropic Claude pricing lists base input, cache writes, cache hits, output tokens, and tool-specific pricing.
- DeepSeek lists `deepseek-v4-flash` and `deepseek-v4-pro` with cache hit, cache miss, and output token rates.
- Gemini API has Free, Paid, and Enterprise tiers; Paid has higher rate limits and batch discounts.
- Runware pricing is pay-as-you-go, varies by model and generation settings, and successful tasks can return exact `cost`.
- ElevenLabs text generation consumes credits based on characters, with exact cost depending on model.

## Implementation Checklist

1. Add `credit_accounts`, `credit_transactions`, `usage_events`, and `price_cards`.
2. Create `services/creditLedger.ts`.
3. Extend provider response types with normalized usage.
4. Parse usage in every provider adapter.
5. Add price-card lookup and charge calculation.
6. Reserve credits before chat/image/video provider calls.
7. Capture and release credits after success/failure.
8. Add `request_id` to generated images and video jobs.
9. Build Billing UI in Settings.
10. Add admin-only price-card management.
11. Add spend caps and provider circuit breakers.
12. Add tests for insufficient balance, failed provider calls, streaming settlement, and idempotent retries.
