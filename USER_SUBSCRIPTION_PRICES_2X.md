# Aria Mind User Pricing, Credits, and Provider Cost Sheet

Last reviewed: 2026-06-09

This file uses official provider pricing pages available on 2026-06-09 and calculates user-facing subscription and credit prices for **2x profit on provider API cost**.

Important definition:

```text
provider cost = direct API/vendor cost
profit = user revenue - provider cost
2x profit on provider cost means:

provider cost = $1.00
required profit = $2.00
required user revenue = $3.00
```

So the baseline multiplier must be:

```text
user charge = provider cost x 3.0
```

This is gross profit only. It does not include payment gateway fees, tax, hosting, storage, support, failed-job handling, refunds, fraud, or discounts. For video, voice agents, and any provider with variable runtime cost, use the exact returned provider cost and charge **at least 3.0x**.

## Executive Recommendation

Use credits, not unlimited usage.

```text
1 Aria credit = $0.01 user-facing value
100 credits = $1.00
minimum charge = ceil(provider_cost_usd x 3.0 / 0.01)
```

Publicly, the user buys monthly Aria credits. Internally, every AI route reserves credits before calling the provider, then captures the final cost after provider usage is known.

## Recommended Subscription Plans

These plans preserve the 3.0x pricing model because credits map directly to dollars.

| Plan | Monthly price | Monthly credits | Max safe provider cost if fully used | Gross profit before other costs | Access policy |
| --- | ---: | ---: | ---: | ---: | --- |
| Free | $0 | 50 | $0.17 marketing cost | Negative by design | Trial only. No video, no Analyzer, very limited Pro. |
| Starter | $12/month | 1,200 | $4.00 | $8.00 | Normal chat, limited images. |
| Plus | $29/month | 2,900 | $9.67 | $19.33 | Normal chat, images, occasional Pro. |
| Pro | $79/month | 7,900 | $26.33 | $52.67 | Heavy chat, Pro, Analyzer, image generation. |
| Studio | $199/month | 19,900 | $66.33 | $132.67 | Creators using image, video, and future voice tools. |

Annual plans should keep the same credit economics:

| Plan | Annual price | Annual credits | Max safe annual provider cost |
| --- | ---: | ---: | ---: |
| Starter annual | $120/year | 12,000 | $40.00 |
| Plus annual | $290/year | 29,000 | $96.67 |
| Pro annual | $790/year | 79,000 | $263.33 |
| Studio annual | $1,990/year | 199,000 | $663.33 |

Do not give 12 months of credits for 10 months of payment unless you accept lower margin. If you offer an annual discount, reduce included credits to match the paid amount or increase per-action credit charges.

## Extra Credit Packs

| Pack | Price | Credits | Max safe provider cost |
| --- | ---: | ---: | ---: |
| Small | $5 | 500 | $1.67 |
| Medium | $20 | 2,000 | $6.67 |
| Large | $50 | 5,000 | $16.67 |
| Studio | $100 | 10,000 | $33.33 |

Purchased credits should not expire quickly. Monthly subscription credits can reset monthly.

## Official Provider Rates Used

All amounts are USD.

| Provider | Model / service | Official provider rate used | Source |
| --- | --- | ---: | --- |
| OpenAI | GPT-5.5 | Input $5 / 1M tokens, cached input $0.50 / 1M, output $30 / 1M | https://openai.com/api/pricing/ |
| OpenAI | GPT-5.4 | Input $2.50 / 1M, cached input $0.25 / 1M, output $15 / 1M | https://openai.com/api/pricing/ |
| OpenAI | GPT-5.4 mini | Input $0.75 / 1M, cached input $0.075 / 1M, output $4.50 / 1M | https://openai.com/api/pricing/ |
| OpenAI | Web search | $10 / 1,000 calls | https://openai.com/api/pricing/ |
| OpenAI | GPT-Image-2 | Image input $8 / 1M tokens, cached image input $2 / 1M, image output $30 / 1M, text input $5 / 1M, cached text input $1.25 / 1M | https://openai.com/api/pricing/ |
| Anthropic | Claude Opus 4.8 | Input $5 / 1M, 5m cache write $6.25 / 1M, 1h cache write $10 / 1M, cache hit $0.50 / 1M, output $25 / 1M | https://platform.claude.com/docs/en/about-claude/pricing |
| Anthropic | Claude Sonnet 4.6 | Input $3 / 1M, cache hit $0.30 / 1M, output $15 / 1M | https://platform.claude.com/docs/en/about-claude/pricing |
| Anthropic | Claude Haiku 4.5 | Input $1 / 1M, cache hit $0.10 / 1M, output $5 / 1M | https://platform.claude.com/docs/en/about-claude/pricing |
| DeepSeek | DeepSeek V4 Pro | Cache hit input $0.003625 / 1M, cache miss input $0.435 / 1M, output $0.87 / 1M | https://api-docs.deepseek.com/quick_start/pricing/ |
| DeepSeek | DeepSeek V4 Flash | Cache hit input $0.0028 / 1M, cache miss input $0.14 / 1M, output $0.28 / 1M | https://api-docs.deepseek.com/quick_start/pricing/ |
| Gemini | Gemini 3.5 Flash paid tier | Input $1.50 / 1M, output $9 / 1M, context cache $0.15 / 1M, Google Search after free tier $14 / 1,000 queries | https://ai.google.dev/gemini-api/docs/pricing |
| Gemini | Gemini 3.1 Flash-Lite paid tier | Input $0.25 / 1M text/image/video, $0.50 / 1M audio; output $1.50 / 1M | https://ai.google.dev/gemini-api/docs/pricing |
| Gemini | Gemini 3.1 Pro Preview paid tier | Input $2 / 1M up to 200k prompt tokens, output $12 / 1M up to 200k prompt tokens | https://ai.google.dev/gemini-api/docs/pricing |
| Gemini | Gemini 3.1 Flash Image | 1K image output about $0.067/image, 2K about $0.101/image, 4K about $0.151/image | https://ai.google.dev/gemini-api/docs/pricing |
| Gemini | Gemini 3.1 Flash TTS Preview | Text input $1 / 1M tokens, audio output $20 / 1M tokens, 25 audio tokens/sec | https://ai.google.dev/gemini-api/docs/pricing |
| xAI | Grok 4.3 / 4.20 | Input $1.25 / 1M, cached input $0.20 / 1M, output $2.50 / 1M | https://docs.x.ai/developers/pricing |
| xAI | Grok Imagine image | Media input $0.002/image, 1K or 2K output $0.02/image | https://docs.x.ai/developers/pricing |
| xAI | Grok Imagine image quality | Media input $0.01/image, 1K output $0.05/image, 2K output $0.07/image | https://docs.x.ai/developers/pricing |
| xAI | Grok Imagine video | Media input $0.01/sec or $0.002/image, output $0.05/sec at 480p, $0.07/sec at 720p | https://docs.x.ai/developers/pricing |
| xAI | Grok voice | Realtime $0.05/min, TTS $15 / 1M chars, STT $0.10/hr REST or $0.20/hr streaming | https://docs.x.ai/developers/pricing |
| Runware | Image/video models | Exact cost varies by model, resolution, duration, steps, and compute time. Use `includeCost` and charge returned `cost`. | https://runware.ai/docs/platform/pricing |
| ElevenLabs | Flash/Turbo TTS | $0.05 / 1K characters | https://elevenlabs.io/pricing/api |
| ElevenLabs | Multilingual v2/v3 TTS | $0.10 / 1K characters | https://elevenlabs.io/pricing/api |
| ElevenLabs | Scribe v1/v2 STT | $0.22 / hour | https://elevenlabs.io/pricing/api |
| ElevenLabs | Scribe v2 Realtime STT | $0.39 / hour | https://elevenlabs.io/pricing/api |
| ElevenLabs | Speech Engine agents | $0.08 / minute included/additional call, burst $0.16 / minute | https://elevenlabs.io/pricing/api |
| ElevenLabs | Dubbing v1 | $0.33 / minute with watermark, $0.50 / minute without watermark | https://elevenlabs.io/pricing/api |

## Text Provider Cost Examples

Assumption for standard text comparison:

```text
3,000 input tokens
1,000 output tokens
no cache
no tools
```

| Provider/model | Provider cost | Minimum user charge at 3.0x | Recommended product charge |
| --- | ---: | ---: | ---: |
| OpenAI GPT-5.5 | $0.045000 | 14 credits | 15 credits |
| Claude Opus 4.8 | $0.040000 | 12 credits | 15 credits |
| Claude Sonnet 4.6 | $0.024000 | 8 credits | 10 credits |
| Gemini 3.5 Flash | $0.013500 | 5 credits | 6 credits |
| GPT-5.4 mini | $0.006750 | 3 credits | 5 credits |
| Grok 4.3 | $0.006250 | 2 credits | 5 credits |
| DeepSeek V4 Pro | $0.002175 | 1 credit | 3 credits |

Recommended rule: charge the higher value of the product minimum or exact metered cost.

```text
credits = max(product_minimum_credits, ceil(provider_cost_usd x 3.0 / 0.01))
```

## Aria Mind Mode Prices

These match the current app routing:

- `aion-mind`: one `gpt-5.4-mini` primary model call, plus live search when needed.
- `aion-mind-pro`: Aria Research. The user selects one engine: GPT-5.5, Opus-4.8, DeepSeek, or Gemini-3.1.
- `aion-mind-analyzer`: Aria Analyzer. GPT-5.5, Opus-4.8, DeepSeek, and Gemini-3.1 candidates run in parallel with live-search context, then a GPT-5.5 judge synthesizes one final answer.

| Aria feature | Assumption | Provider cost | Minimum charge at 3.0x | Recommended user charge |
| --- | --- | ---: | ---: | ---: |
| Aria Mind short chat | GPT-5.4 mini, 1k input, 400 output | $0.002550 | 1 credit | 3 credits |
| Aria Mind normal chat | GPT-5.4 mini, 3k input, 1k output | $0.006750 | 3 credits | 5 credits |
| Aria Mind long chat | GPT-5.4 mini, 8k input, 1.5k output | $0.012750 | 4 credits | 8 credits |
| File/image attachment chat | GPT-5.4 mini, 20k input, 2k output | $0.024000 | 8 credits | 10 credits minimum |
| Live web search add-on | One OpenAI web-search call | $0.010000 | 3 credits | +3 credits plus model tokens |
| Aria Research, GPT-5.5 | One selected GPT-5.5 research call, 3k input, 1k output | $0.045000 | 14 credits | 15 credits |
| Aria Research, Opus-4.8 | One selected Opus-4.8 research call, 3k input, 1k output | $0.040000 | 12 credits | 15 credits |
| Aria Research, DeepSeek | One selected DeepSeek research call, 3k input, 1k output | $0.002175 | 1 credit | 3 credits |
| Aria Research, Gemini-3.1 | One selected Gemini research call, 3k input, 1k output | $0.013500 | 5 credits | 6 credits |
| Aria Analyzer | Four candidates + GPT-5.5 judge + one live-search call | $0.180675 | 55 credits | 70 credits |

Do not hardcode only these numbers. If a request is longer than the assumption, charge exact metered cost. For example, a very long Research request should cost more than the default selected-model price.

## Image Prices

Recommended starting prices:

| Image feature | Provider basis | Provider cost | Minimum at 3.0x | Recommended user charge |
| --- | --- | ---: | ---: | ---: |
| Low-cost 1K image | xAI Grok Imagine image, 1K | $0.022000 | 7 credits | 10 credits |
| Quality 1K image | xAI Grok Imagine image quality, 1K | $0.060000 | 18 credits | 20 credits |
| Gemini 1K image | Gemini 3.1 Flash Image, 1K | $0.067000 | 21 credits | 25 credits |
| Gemini 2K image | Gemini 3.1 Flash Image, 2K | $0.101000 | 31 credits | 35 credits |
| Gemini 4K image | Gemini 3.1 Flash Image, 4K | $0.151000 | 46 credits | 50 credits |
| Runware image | Exact returned `cost` | dynamic | `ceil(cost x 3 / 0.01)` | minimum 10 credits |
| OpenAI GPT-Image-2 | Token-based | dynamic | `ceil(cost x 3 / 0.01)` | minimum 50 credits until measured |

OpenAI image generation is token-priced rather than a simple per-image public price. For organization safety, do not publish a fixed OpenAI image credit price until your app records actual image token usage/cost for your chosen size/quality.

## Video Prices

Video should always be quoted before generation.

| Video feature | Provider basis | Provider cost | Minimum at 3.0x | Recommended user charge |
| --- | --- | ---: | ---: | ---: |
| xAI video 480p, 5 sec | $0.05/sec output | $0.250000 | 75 credits | 80 credits |
| xAI video 720p, 5 sec | $0.07/sec output | $0.350000 | 105 credits | 110 credits |
| xAI video 1.5 preview 720p, 5 sec image-to-video | $0.01 image + $0.14/sec output | $0.710000 | 214 credits | 225 credits |
| Runware video | Exact returned `cost` | dynamic | `ceil(cost x 3 / 0.01)` | minimum 150 credits |

For the current app, Runware is the active video provider. The app already requests `includeCost: true` in `services/runwareVideo.ts`, so bill from Runware's returned `cost` rather than guessing.

## Voice and Audio Prices

Use these when adding ElevenLabs and future Gemini/xAI voice features.

| Feature | Provider basis | Provider cost | Minimum at 3.0x | Recommended user charge |
| --- | --- | ---: | ---: | ---: |
| ElevenLabs Flash/Turbo TTS | 1K chars | $0.050000 | 16 credits | 20 credits / 1K chars |
| ElevenLabs Multilingual v2/v3 TTS | 1K chars | $0.100000 | 31 credits | 35 credits / 1K chars |
| ElevenLabs Scribe STT | 1 hour | $0.220000 | 66 credits | 75 credits / hour |
| ElevenLabs Realtime STT | 1 hour | $0.390000 | 117 credits | 125 credits / hour |
| ElevenLabs Speech Engine agent | 1 minute | $0.080000 | 24 credits | 30 credits / minute |
| ElevenLabs Dubbing without watermark | 1 minute | $0.500000 | 150 credits | 160 credits / minute |
| Gemini Flash TTS Preview | 1 minute output, 25 audio tokens/sec | $0.030000 | 9 credits | 10 credits / minute |
| xAI TTS | 1K chars | $0.015000 | 5 credits | 8 credits / 1K chars |
| xAI streaming STT | 1 hour | $0.200000 | 61 credits | 70 credits / hour |

Voice agents are high-risk for cost overruns. Always reserve by maximum call duration, then settle after the call ends.

## Recommended Public Feature Prices

Use this table in the app UI after credit tracking exists.

| User action | Public credit price |
| --- | ---: |
| Aria Mind short message | 6 credits |
| Aria Mind normal message | 15 credits |
| Aria Mind long message | 30+ credits |
| Attachment/file/image analysis | 50+ credits |
| Live web search | +3 credits |
| Aria Research answer | selected model, 3-15+ credits |
| Aria Analyzer answer | 70+ credits |
| Low-cost image | 10 credits |
| Standard 1K image | 25 credits |
| 2K image | 35 credits |
| 4K image | 50 credits |
| Video | quoted before generation, minimum 150 credits |
| ElevenLabs Flash/Turbo TTS | 20 credits / 1K chars |
| ElevenLabs Multilingual TTS | 35 credits / 1K chars |
| Speech-to-text | 75 credits / hour |
| Voice agent | 30 credits / minute |
| Dubbing | 160 credits / minute |

The `+` means the backend must meter actual usage and charge more if the provider cost is above the default assumption.

## Plan Usage Examples

These are examples, not exact promised limits.

| Plan | Normal chats at 5 credits | Research answers at 15 credits | Analyzer answers at 70 credits | Standard 1K images at 25 credits |
| --- | ---: | ---: | ---: | ---: |
| Free | 10 | 3 | 0 | 2 |
| Starter | 240 | 80 | 17 | 48 |
| Plus | 580 | 193 | 41 | 116 |
| Pro | 1,580 | 526 | 112 | 316 |
| Studio | 3,980 | 1,326 | 284 | 796 |

Do not advertise these as guaranteed if the app meters exact usage. Say "roughly" or "typical".

## Implementation Rules

1. Do not offer unlimited AI.
2. Every AI route must reserve credits before the provider call.
3. Every provider response must record normalized usage and provider cost.
4. Charge `max(product_minimum, actual_provider_cost x 3.0)`.
5. Research must charge for the selected engine; Analyzer must charge for all candidate calls, live search, and the judge.
6. Web search, tools, attachments, video, voice, and dubbing must be additive.
7. Runware must use returned `cost`; do not estimate video cost from duration alone.
8. ElevenLabs must quote by characters/minutes before generation.
9. Stop the request if balance is below the reservation.
10. Add daily credit-spend caps per user and provider kill switches.

## Pricing Sources

- OpenAI API pricing: https://openai.com/api/pricing/
- Anthropic Claude API pricing: https://platform.claude.com/docs/en/about-claude/pricing
- DeepSeek models and pricing: https://api-docs.deepseek.com/quick_start/pricing/
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- xAI pricing: https://docs.x.ai/developers/pricing
- Runware pricing: https://runware.ai/docs/platform/pricing
- ElevenLabs API pricing: https://elevenlabs.io/pricing/api
