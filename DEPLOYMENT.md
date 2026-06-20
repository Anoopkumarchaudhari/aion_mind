# Aion Mind / AriamindX — Deployment Guide

Deployment, hosting-provider comparison, full feature + pricing breakdown, and a
cost-effective recommendation for this app.

> **App profile (read this first — it drives every hosting choice below)**
> - **Framework:** Next.js 15 (App Router) — SSR + API routes + **streaming chat responses**. Needs a long-lived **Node.js runtime**, not a pure static host.
> - **Database:** PostgreSQL (currently Supabase pooler). App auto-creates auth/session/chat tables on first connection.
> - **File writes:** Generated images are saved to the **local disk** at `data/generated-images/` and served via `/api/images/:id`. ⚠️ This needs a **persistent filesystem or object storage** — it breaks on stateless serverless.
> - **Long jobs:** Video generation polls providers for up to 60s+ (`AION_IMAGE_TIMEOUT_MS=60000`, `RUNWARE_VIDEO_TIMEOUT_MS=60000`). ⚠️ Serverless platforms with short function limits (10–15s) will time these out.
> - **Webhooks:** Razorpay `payment.captured` → `/api/payments/razorpay/webhook` (needs a stable public URL).
> - **Outbound:** OpenAI, Anthropic, Gemini, DeepSeek, Qwen, Grok, Runware, Tavily, Google OAuth, nodemailer SMTP.

These four ⚠️ constraints (disk writes, long jobs, streaming, webhooks) mean a
**container / VM / always-on host fits this app far better than short-lived
serverless functions** unless you offload images to object storage and move
video polling to a background worker.

---

## 1. Quick start (any host)

```bash
# 1. Install
npm ci

# 2. Build
npm run build

# 3. Run (production)
npm run start            # serves on PORT (default 3000)
```

Required environment variables (see `.env.example` for the full list):

| Group | Keys |
|---|---|
| Database | `AION_PG_HOST`, `AION_PG_PORT`, `AION_PG_DATABASE`, `AION_PG_USER`, `AION_PG_PASSWORD`, `AION_PG_SSL` (or `DATABASE_URL`) |
| AI providers | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `QWEN_API_KEY`, `GROK_API_KEY` |
| Media | `RUNWARE_API_KEY`, `TAVILY_API_KEY` |
| Auth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Email | SMTP creds used by `nodemailer` (see `services/email.ts`) |
| Admin | `AION_ADMIN_EMAILS` |

**After deploy, update these to the production origin:**
- Google OAuth redirect URI → `https://your-domain/api/auth/google/callback`
- Razorpay webhook URL → `https://your-domain/api/payments/razorpay/webhook`

---

## 2. Hosting provider comparison (the app server)

Prices are **entry/production tiers as of mid-2026**; always confirm on the
provider's pricing page — they change often. "Fits this app?" weighs the four
⚠️ constraints above.

| Provider | Model | Entry price (prod) | Persistent disk | Long requests (>30s) | Streaming SSR | Fits this app? |
|---|---|---|---|---|---|---|
| **Hetzner Cloud (VPS)** | VM (self-managed) | **~$4.5/mo** (CX22: 2 vCPU/4 GB) | ✅ Yes | ✅ Unlimited | ✅ Yes | ⭐ **Best value** |
| **DigitalOcean Droplet** | VM (self-managed) | ~$6/mo (1 vCPU/1 GB), $12 (2 GB) | ✅ Yes | ✅ Unlimited | ✅ Yes | ✅ Great |
| **Railway** | Container (managed) | ~$5/mo credit, then usage (~$5–20) | ✅ Volumes | ✅ Yes | ✅ Yes | ✅ Easiest "real server" |
| **Render** | Container (managed) | $7/mo (Starter, 512 MB) | ✅ Disks (paid add-on) | ✅ Yes | ✅ Yes | ✅ Good |
| **Fly.io** | Container (edge VMs) | ~$3–5/mo (shared-cpu-1x) | ✅ Volumes | ✅ Yes | ✅ Yes | ✅ Good, global |
| **DO App Platform** | PaaS (managed) | $5/mo (Basic) | ⚠️ Ephemeral (use Spaces) | ✅ Yes | ✅ Yes | ✅ OK |
| **Vercel** | Serverless / Fluid | Free → **$20/mo** (Pro) | ❌ Ephemeral | ⚠️ 60s (Pro), 300s (max) | ✅ Yes (native Next.js) | ⚠️ Needs object storage + worker |
| **Netlify** | Serverless | Free → $19/mo (Pro) | ❌ Ephemeral | ⚠️ 10s default, 26s max | ✅ Yes | ⚠️ Video polling will time out |
| **AWS Amplify / Lambda** | Serverless | Pay-as-you-go (~$10–30) | ❌ Ephemeral | ⚠️ 15 min Lambda, but cost/complexity | ✅ Yes | ⚠️ Complex |
| **AWS EC2 / Lightsail** | VM | $3.5–10/mo (Lightsail) | ✅ Yes | ✅ Unlimited | ✅ Yes | ✅ Good, more ops |
| **Cloudflare Pages/Workers** | Edge | Free → $5/mo | ❌ No Node fs; Workers runtime | ⚠️ CPU-time limits | ⚠️ Partial Next.js support | ❌ Not recommended (fs + Node deps) |
| **Google Cloud Run** | Container (serverless) | Pay-per-use (~$5–15) | ⚠️ Ephemeral (use GCS) | ✅ 60 min | ✅ Yes | ✅ Scales to zero |

### Reading the table
- **VPS (Hetzner / DO Droplet / Lightsail):** cheapest and removes all four ⚠️ constraints in one shot, because you get a real Linux box with a disk. Trade-off: **you manage OS, Node, Nginx, SSL, and updates yourself.**
- **Managed containers (Railway / Render / Fly):** the sweet spot — real persistent runtime, attach a volume, deploy from Git, no OS babysitting. Slightly pricier than raw VPS.
- **Serverless (Vercel / Netlify / Lambda):** the *easiest* Next.js deploy and the best autoscaling, **but** this app's local image writes and 60s video polling fight the serverless model. Viable only if you (a) move images to S3/R2/Spaces and (b) move video polling to a queue/worker.

---

## 3. Database provider comparison

The app needs **PostgreSQL** (it already uses the Supabase pooler).

| Provider | Free tier | Paid entry | Notes | Fits this app? |
|---|---|---|---|---|
| **Supabase** | 500 MB, 2 projects | $25/mo (Pro, 8 GB) | Already in use; pooler + SSL ready | ⭐ Recommended (status quo) |
| **Neon** | 0.5 GB, scales to zero | ~$19/mo | Serverless Postgres, branch DBs, cheap idle | ⭐ Best for low traffic |
| **Railway Postgres** | — | ~$5+/mo usage | Co-locate with app on Railway | ✅ Simple if app is on Railway |
| **Aiven / RDS** | — | $15–30/mo+ | Enterprise, more ops | ✅ For scale |
| **Self-host on the VPS** | $0 (same box) | $0 | Postgres on the same Hetzner/DO VM | ⭐ Cheapest; you handle backups |

> **Tip:** Pairing a **VPS app + Postgres on the same VPS** is the absolute
> cheapest path, but you own backups/HA. Pairing a **managed app + Neon/Supabase**
> is safer for production data.

---

## 4. Object storage (needed if you go serverless)

`data/generated-images/` only works on a persistent disk. On serverless, swap to:

| Provider | Price | Egress | Notes |
|---|---|---|---|
| **Cloudflare R2** | $0.015/GB-mo | **$0 egress** ⭐ | Cheapest for served media |
| **Backblaze B2** | $0.006/GB-mo | $0 to Cloudflare | Cheapest storage |
| **AWS S3** | $0.023/GB-mo | $0.09/GB egress | Standard, pricey egress |
| **DO Spaces** | $5/mo (250 GB) | 1 TB included | Flat-rate, S3-compatible |

On a VPS or persistent-volume host you can **skip this entirely** and keep the
local-disk behavior the app already ships with.

---

## 5. AI provider cost reference (per the app's configured models)

These are **usage costs**, billed by the AI vendors per token/image/video —
separate from hosting. Values from `.env.example` and the repo pricing docs;
verify against each vendor's current rates.

| Provider | Configured model(s) | Approx. price (per 1M tokens, in/out) | Used for |
|---|---|---|---|
| **DeepSeek** | `deepseek-v4-pro` | **$1.74 / $3.48** (promo: $0.435 / $0.87) | ⭐ Cheapest strong model |
| | `deepseek-v4-flash` | $0.14 / $0.28 | Cheap/fast tier |
| **OpenAI** | `gpt-5.4-mini` | Low (mini tier) | Default chat |
| | `gpt-5.5` | Premium | Advanced + judge |
| | `gpt-image-1` / `-mini` | Per-image | Image gen |
| **Anthropic** | `claude-sonnet-4-6` | Mid | Quality chat |
| | `claude-opus-4-8` | Premium | Hardest tasks |
| **Gemini** | `gemini-3.1-pro-preview` | Mid | Multimodal |
| | `veo-3.1-*` | Per-video (high) | Video gen |
| **Qwen** | `qwen3-max` | Low–mid | Alt provider |
| **Runware** | `runware:100@1` etc. | Per-image/video (low) | ⭐ Cheap media gen |
| **Tavily** | search | Free tier + usage | Web search |

> The app has **per-provider USD budgets** (`ANTHROPIC_BUDGET_USD`,
> `DEEPSEEK_BUDGET_USD`, etc.) and a model router — use these to cap spend.
> Route default traffic to **DeepSeek Flash / GPT-mini / Qwen** and reserve
> **Opus / GPT-5.5 / Veo** for premium requests. See `PRICING_AND_CREDITS.md`.

---

## 6. Other paid services

| Service | Purpose | Price |
|---|---|---|
| **Domain** | your-domain.com | ~$10–15/yr |
| **SSL** | HTTPS | **Free** (Let's Encrypt / host-managed) |
| **Razorpay** | Payments | No monthly fee; **2% per transaction** (India) |
| **Email/SMTP** | nodemailer | Free (Gmail SMTP, low volume) → $15–20/mo (SendGrid/SES at scale) |
| **Google OAuth** | Sign-in | Free |

---

## 7. Recommended deployment recipes

### 🥇 Cheapest production (DIY) — ~$5/mo + usage
**Hetzner CX22 VPS** (or DO Droplet) running the app + Postgres on the same box.
- App: `npm run build && npm run start` behind **Nginx** reverse proxy.
- Process manager: **PM2** or a **systemd** service (auto-restart).
- SSL: **Caddy** or Nginx + Certbot (free).
- Keeps local image storage and long video jobs working with zero extra services.
- **You own:** OS updates, DB backups (`pg_dump` cron to B2/R2).

### 🥈 Easiest "real server" — ~$10–15/mo + usage
**Railway** (or Render) for the app with an attached **volume** for
`data/generated-images/`, plus **Neon** or **Supabase** Postgres.
- Git push to deploy, managed SSL, logs, metrics. No OS to manage.
- All four ⚠️ constraints handled out of the box.

### 🥉 Max scale / best Next.js DX — ~$20/mo + usage
**Vercel Pro** for the app + **Neon** Postgres + **Cloudflare R2** for images.
- Requires refactor: image writes → R2, video polling → background job/queue.
- Best autoscaling and global edge, highest convenience, highest lock-in.

---

## 8. Cost-effective summary

| Setup | Monthly fixed | Best for | Effort |
|---|---|---|---|
| ⭐ **Hetzner VPS + self-hosted Postgres** | **~$5** | Lowest cost, full control, no constraint workarounds | High (you run ops) |
| **Railway/Render + Neon** | ~$12–15 | Best balance of price/ease, zero refactor | Low |
| **Vercel Pro + Neon + R2** | ~$25+ | Scale & DX, willing to refactor | Medium |

**Bottom line — most cost-effective recommendation:**

> **Run the app on a single Hetzner CX22 VPS (~$4.5/mo) with PostgreSQL on the
> same box, Nginx + Let's Encrypt for free SSL, and PM2/systemd to keep Next.js
> alive.** It is the cheapest option *and* the best technical fit, because the
> VPS's persistent disk and unlimited request duration natively support the
> app's local image storage and long video-generation jobs — no object storage
> or worker refactor required. Total fixed cost: **~$5/mo + a ~$12/yr domain**,
> with AI usage billed separately and capped by the app's built-in per-provider
> USD budgets.
>
> Choose **Railway/Render + Neon (~$12–15/mo)** instead if you'd rather pay a
> little more to avoid managing a Linux server. Reserve **Vercel** for when you
> need aggressive autoscaling and are ready to move images to R2 and video
> polling to a background worker.

---

## 9. Pre-launch checklist

- [ ] All env vars set in the host's secret manager (never commit `.env`)
- [ ] `AION_PG_SSL=true` for hosted Postgres
- [ ] Google OAuth redirect URI points to production domain
- [ ] Razorpay live keys + webhook URL configured and verified
- [ ] `AION_DEBUG=false` and `NEXT_PUBLIC_AION_DEBUG=false` in production
- [ ] Persistent storage confirmed for `data/generated-images/` (volume or object storage)
- [ ] `AION_ADMIN_EMAILS` set to real admin accounts
- [ ] Database backup schedule in place (`pg_dump` cron)
- [ ] Per-provider `*_BUDGET_USD` caps reviewed
- [ ] HTTPS/SSL active and HTTP→HTTPS redirect on
