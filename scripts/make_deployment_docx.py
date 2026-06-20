#!/usr/bin/env python3
"""Generate AriamindX_Deployment_Comparison.docx with no external deps.

A .docx is a zip of WordprocessingML XML. We build tables for hosting, database,
object storage and AI provider costs, each with price / RAM / storage columns.
"""
import zipfile
from xml.sax.saxutils import escape

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def run(text, bold=False, size=20, color=None):
    rpr = "<w:rPr>"
    if bold:
        rpr += "<w:b/>"
    if color:
        rpr += f'<w:color w:val="{color}"/>'
    rpr += f'<w:sz w:val="{size}"/></w:rPr>'
    return f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def para(text="", bold=False, size=20, color=None, align=None, space_after=120):
    ppr = "<w:pPr>"
    if align:
        ppr += f'<w:jc w:val="{align}"/>'
    ppr += f'<w:spacing w:after="{space_after}"/></w:pPr>'
    body = run(text, bold, size, color) if text else ""
    return f"<w:p>{ppr}{body}</w:p>"


def heading(text, size=28, color="1F6F4A"):
    return para(text, bold=True, size=size, color=color, space_after=80)


def cell(text, bold=False, shade=None, size=18, color=None, width=None):
    tcpr = "<w:tcPr>"
    if width:
        tcpr += f'<w:tcW w:w="{width}" w:type="dxa"/>'
    if shade:
        tcpr += f'<w:shd w:val="clear" w:color="auto" w:fill="{shade}"/>'
    tcpr += '<w:vAlign w:val="center"/></w:tcPr>'
    ppr = '<w:pPr><w:spacing w:after="20"/></w:pPr>'
    return (f"<w:tc>{tcpr}<w:p>{ppr}"
            f"{run(text, bold, size, color)}</w:p></w:tc>")


def table(headers, rows, widths=None, header_fill="1F6F4A"):
    n = len(headers)
    widths = widths or [int(9360 / n)] * n
    borders = (
        '<w:tblBorders>'
        + ''.join(f'<w:{e} w:val="single" w:sz="4" w:space="0" w:color="BBBBBB"/>'
                  for e in ("top", "left", "bottom", "right", "insideH", "insideV"))
        + '</w:tblBorders>'
    )
    tblpr = (f'<w:tblPr><w:tblW w:w="9360" w:type="dxa"/>{borders}'
             '<w:tblLayout w:type="fixed"/></w:tblPr>')
    grid = "<w:tblGrid>" + "".join(
        f'<w:gridCol w:w="{w}"/>' for w in widths) + "</w:tblGrid>"
    head = "<w:tr>" + "".join(
        cell(h, bold=True, shade=header_fill, color="FFFFFF", width=widths[i])
        for i, h in enumerate(headers)) + "</w:tr>"
    body = ""
    for ri, r in enumerate(rows):
        fill = "EAF3EE" if ri % 2 == 0 else None
        body += "<w:tr>" + "".join(
            cell(c, shade=fill, width=widths[i]) for i, c in enumerate(r)
        ) + "</w:tr>"
    return f"<w:tbl>{tblpr}{grid}{head}{body}</w:tbl>" + para("", space_after=80)


parts = []
parts.append(para("AriamindX / Aion Mind", bold=True, size=44, color="1F6F4A",
                  align="center", space_after=40))
parts.append(para("Deployment & Hosting Provider Comparison",
                  bold=True, size=30, color="333333", align="center"))
parts.append(para("Price • RAM • Storage • Suitability  |  Next.js 15 + PostgreSQL app",
                  size=18, color="777777", align="center", space_after=240))

parts.append(heading("App profile (drives every choice)"))
for line in [
    "Framework: Next.js 15 (App Router) — SSR + API routes + streaming chat. Needs an always-on Node.js runtime.",
    "Database: PostgreSQL (currently Supabase pooler). Tables auto-create on first connect.",
    "File writes: generated images saved to local disk (data/generated-images/). Needs persistent disk or object storage.",
    "Long jobs: video generation polls providers 60s+. Short serverless function limits will time out.",
    "Webhooks: Razorpay payment.captured needs a stable public URL.",
]:
    parts.append(para("•  " + line, size=18, space_after=60))
parts.append(para("Conclusion: a VPS / container / VM with a real disk fits this app better than short-lived serverless.",
                  bold=True, size=18, color="1F6F4A", space_after=200))

# ---------- Hosting comparison ----------
parts.append(heading("1. Hosting providers — app server (all major providers)"))
parts.append(para("Specs shown are the entry production tier at the listed price. Prices mid-2026; verify on provider pages.",
                  size=16, color="777777"))
host_headers = ["Provider", "Type", "Price/mo", "RAM", "Storage (disk)", "Long jobs", "Fit"]
host_widths = [1500, 1450, 1150, 1100, 1750, 1150, 1260]
host_rows = [
    ["Hetzner Cloud CX22", "VPS (VM)", "~$4.50", "4 GB", "40 GB SSD (persistent)", "Unlimited", "BEST value"],
    ["Hetzner Cloud CX32", "VPS (VM)", "~$7.00", "8 GB", "80 GB SSD (persistent)", "Unlimited", "Great"],
    ["Hostinger VPS KVM 1", "VPS (VM)", "~$5–7 promo*", "4 GB", "50 GB NVMe", "Unlimited", "Good (India DC)"],
    ["Hostinger VPS KVM 2", "VPS (VM)", "~$7–9 promo*", "8 GB", "100 GB NVMe", "Unlimited", "Good (India DC)"],
    ["Hostinger Shared/Web", "Shared (PHP)", "$2–4", "shared", "shared (no Node svc)", "No", "NOT suitable"],
    ["DigitalOcean Droplet", "VPS (VM)", "$6 / $12", "1 GB / 2 GB", "25 / 50 GB SSD", "Unlimited", "Great"],
    ["DO App Platform", "PaaS", "$5", "512 MB", "Ephemeral (use Spaces)", "Yes", "OK"],
    ["Linode / Akamai", "VPS (VM)", "$5", "1 GB", "25 GB SSD", "Unlimited", "Great"],
    ["Vultr", "VPS (VM)", "$5 / $6", "1 GB", "25 / 55 GB SSD", "Unlimited", "Great"],
    ["AWS Lightsail", "VPS (VM)", "$3.5 / $5 / $12", "0.5 / 1 / 2 GB", "20 / 40 / 60 GB SSD", "Unlimited", "Good"],
    ["AWS EC2 t3.small", "VM", "~$15 +EBS", "2 GB", "EBS (you size, persistent)", "Unlimited", "More ops"],
    ["Railway", "Container", "~$5 credit +use", "0.5–8 GB (set)", "Volumes (persistent)", "Yes", "Easiest server"],
    ["Render", "Container", "$7 (Starter)", "512 MB", "Disk add-on $0.25/GB", "Yes", "Good"],
    ["Fly.io", "Edge VMs", "~$3–5", "256 MB–1 GB", "Volumes $0.15/GB", "Yes", "Good, global"],
    ["Google Cloud Run", "Serverless ctr", "Pay-per-use", "128 MB–32 GB (set)", "Ephemeral (use GCS)", "60 min", "Scales to 0"],
    ["Vercel Pro", "Serverless", "$20", "1–3 GB (function)", "Ephemeral (use R2/S3)", "60–300 s", "Needs refactor"],
    ["Netlify Pro", "Serverless", "$19", "1 GB (function)", "Ephemeral", "10–26 s", "Video times out"],
    ["AWS Amplify/Lambda", "Serverless", "~$10–30 use", "up to 10 GB (fn)", "Ephemeral (use S3)", "15 min", "Complex"],
    ["Cloudflare Pages", "Edge", "$5", "128 MB", "No Node fs", "CPU-limited", "Not advised"],
]
parts.append(table(host_headers, host_rows, host_widths))
parts.append(para("* Hostinger promo prices need a 24–48 month upfront prepay and renew at roughly 2x. Hetzner/DO/Vultr/Linode bill monthly with no lock-in.",
                  size=16, color="777777", space_after=160))

# ---------- Database ----------
parts.append(heading("2. Database providers — PostgreSQL"))
db_headers = ["Provider", "Free tier", "Paid entry", "Storage", "RAM/compute", "Fit"]
db_widths = [1600, 1700, 1450, 1450, 1700, 1460]
db_rows = [
    ["Supabase", "500 MB, 2 proj", "$25 (Pro)", "8 GB incl.", "Shared → dedicated", "In use now"],
    ["Neon", "0.5 GB, idle→0", "~$19", "10 GB+", "Autoscale, scales to 0", "Best low-traffic"],
    ["Railway Postgres", "—", "~$5 +use", "Volume-based", "Set per service", "If app on Railway"],
    ["Aiven / AWS RDS", "—", "$15–30+", "20 GB+", "Dedicated", "For scale"],
    ["Self-host on VPS", "$0 (same box)", "$0", "Shares VPS disk", "Shares VPS RAM", "Cheapest"],
]
parts.append(table(db_headers, db_rows, db_widths))

# ---------- Object storage ----------
parts.append(heading("3. Object storage (only if serverless / no persistent disk)"))
os_headers = ["Provider", "Storage price", "Egress", "Notes"]
os_widths = [1900, 2300, 2200, 2960]
os_rows = [
    ["Cloudflare R2", "$0.015 / GB-mo", "$0 (free)", "Cheapest to serve media"],
    ["Backblaze B2", "$0.006 / GB-mo", "$0 to Cloudflare", "Cheapest storage"],
    ["AWS S3", "$0.023 / GB-mo", "$0.09 / GB", "Standard, pricey egress"],
    ["DigitalOcean Spaces", "$5 (250 GB)", "1 TB included", "Flat rate, S3-compatible"],
]
parts.append(table(os_headers, os_rows, os_widths))
parts.append(para("On a VPS or volume host you can skip this — the app's local-disk image storage already works.",
                  size=16, color="777777", space_after=200))

# ---------- AI provider cost ----------
parts.append(heading("4. AI provider usage costs (billed separately by vendors)"))
ai_headers = ["Provider", "Configured model", "Price /1M tok (in / out)", "Role"]
ai_widths = [1500, 2400, 2700, 2760]
ai_rows = [
    ["DeepSeek", "deepseek-v4-pro", "$1.74 / $3.48 (promo $0.44/$0.87)", "Cheapest strong"],
    ["DeepSeek", "deepseek-v4-flash", "$0.14 / $0.28", "Cheap/fast"],
    ["OpenAI", "gpt-5.4-mini", "Low (mini tier)", "Default chat"],
    ["OpenAI", "gpt-5.5", "Premium", "Advanced + judge"],
    ["Anthropic", "claude-sonnet-4-6", "Mid", "Quality chat"],
    ["Anthropic", "claude-opus-4-8", "Premium", "Hardest tasks"],
    ["Gemini", "gemini-3.1-pro-preview", "Mid", "Multimodal"],
    ["Gemini", "veo-3.1-* (video)", "Per-video (high)", "Video gen"],
    ["Qwen", "qwen3-max", "Low–mid", "Alt provider"],
    ["Runware", "runware:100@1 / 400@1", "Per-image/video (low)", "Cheap media gen"],
    ["Tavily", "search", "Free tier + usage", "Web search"],
]
parts.append(table(ai_headers, ai_rows, ai_widths))
parts.append(para("App has per-provider USD budget caps and a model router. Route default traffic to DeepSeek Flash / GPT-mini / Qwen; reserve Opus / GPT-5.5 / Veo for premium.",
                  size=16, color="777777", space_after=200))

# ---------- Hostinger spotlight ----------
parts.append(heading("5. Hostinger — is it a fit?"))
parts.append(para("Use Hostinger VPS (KVM), NOT shared/web hosting. Shared hosting is PHP/WordPress-oriented and cannot run a persistent Next.js Node process or long jobs. Hostinger VPS works exactly like the Hetzner recipe: full root, persistent NVMe disk, self-host Postgres, local image storage and long video jobs all supported.",
                  size=18, space_after=100))
hg_headers = ["Point", "Verdict"]
hg_widths = [3000, 6360]
hg_rows = [
    ["Shared / Web hosting", "Not suitable — no persistent Node server, no long jobs, no root."],
    ["VPS KVM plans", "Suitable — same as a Hetzner/DO VPS; NVMe disk is a plus."],
    ["Specs vs Hetzner", "On par: KVM 1 = 4 GB ~ $5; KVM 2 = 8 GB ~ $7-9 (promo)."],
    ["India datacenter (Mumbai)", "Advantage — lower latency for Razorpay/India users; Hetzner has no India region."],
    ["Pricing catch", "Cheap price needs 24-48 mo prepay and renews ~2x. Compare effective/renewal price."],
    ["Recommended plan", "KVM 1 if video OFF; KVM 2 (8 GB / 100 GB NVMe) if video ON."],
]
parts.append(table(hg_headers, hg_rows, hg_widths))
parts.append(para("Verdict: Hostinger VPS KVM 2 is a solid pick — its Mumbai DC suits an India/Razorpay audience that Hetzner can't match. Just pick VPS (not shared) and check the renewal price/term. For no lock-in pure price/perf, Hetzner CX22/CX32 is the alternative.",
                  bold=True, size=18, color="1F6F4A", space_after=200))

# ---------- 10k user sizing ----------
parts.append(heading("6. Resource sizing — 10,000 users (video OFF vs ON)"))
parts.append(para("Assumptions: 10k registered users, ~1-3% concurrent at peak (~100-300 simultaneous), app + Postgres co-located. Engineering estimates, not measured. KEY FACT: generated images are written to local disk, but videos are stored as the provider's URL (NOT on your disk) — so enabling video barely changes storage; it mainly raises RAM/concurrency and AI cost.",
                  size=18, space_after=100))
parts.append(para("Storage (10k users)", bold=True, size=20, color="333333", space_after=40))
s10_headers = ["Component", "Video OFF", "Video ON"]
s10_widths = [4200, 2580, 2580]
s10_rows = [
    ["PostgreSQL (chats, library, users)", "~20–40 GB", "~20–40 GB"],
    ["Generated images on disk (1–3 MB each)", "~50–150 GB", "~50–150 GB"],
    ["Generated videos (provider URL, not on disk)", "~0 GB", "~0 GB"],
    ["OS + app + node_modules + logs", "~5–10 GB", "~5–10 GB"],
    ["Recommended volume (+ headroom)", "150–200 GB", "150–200 GB"],
]
parts.append(table(s10_headers, s10_rows, s10_widths))
parts.append(para("RAM (10k users)", bold=True, size=20, color="333333", space_after=40))
r10_headers = ["Component", "Video OFF", "Video ON"]
r10_widths = [4200, 2580, 2580]
r10_rows = [
    ["Next.js baseline", "~0.3–0.4 GB", "~0.3–0.4 GB"],
    ["Concurrent chat streams (100–300)", "~0.5–1 GB", "~0.5–1 GB"],
    ["Image-gen base64 buffers (spikes)", "~0.2–0.5 GB", "~0.2–0.5 GB"],
    ["Video polling jobs (long-held 60s+)", "—", "~0.5–1.5 GB peak"],
    ["PostgreSQL (shared_buffers + pool)", "~0.8–1 GB", "~0.8–1 GB"],
    ["Recommended box RAM", "4 GB", "8 GB"],
]
parts.append(table(r10_headers, r10_rows, r10_widths))
parts.append(para("Recommended box: Video OFF -> 4 GB / 2 vCPU / 80-160 GB (Hetzner CX22 or Hostinger KVM 1), ~$5-8/mo. Video ON -> 8 GB / 4 vCPU / 160-200 GB (Hetzner CX32 or Hostinger KVM 2), ~$8-12/mo. Biggest lever: image retention (auto-delete or offload to R2/Spaces) — that, not video, is what makes disk grow unbounded.",
                  size=18, color="555555", space_after=200))

# ---------- 100k full sizing ----------
parts.append(heading("7. Resource sizing — 100,000 users (storage, RAM, chat)"))
parts.append(para("Assumptions: 100k registered users, ~1-3% concurrent at peak (~1,000-3,000 simultaneous). At this scale a single box is NOT enough — scale the app tier horizontally (several instances behind a load balancer) with a dedicated/managed Postgres. Generated images must move to object storage (R2/Spaces); a 1+ TB local disk is impractical.",
                  size=18, space_after=100))

parts.append(para("Storage (100k users)", bold=True, size=20, color="333333", space_after=40))
s100_headers = ["Component", "Video OFF", "Video ON"]
s100_widths = [4200, 2580, 2580]
s100_rows = [
    ["PostgreSQL — all tables (chat + library + users)", "~40–80 GB", "~40–80 GB"],
    ["Generated images (offload to object storage)", "~0.5–1.5 TB", "~0.5–1.5 TB"],
    ["Generated videos (provider URL, not on disk)", "~0 GB", "~0 GB"],
    ["OS + app + logs (per instance)", "~10–20 GB", "~10–20 GB"],
    ["DB volume recommended", "100–250 GB", "100–250 GB"],
    ["Images: object storage (R2/Spaces)", "by GB used", "by GB used"],
]
parts.append(table(s100_headers, s100_rows, s100_widths))

parts.append(para("RAM / compute (100k users)", bold=True, size=20, color="333333", space_after=40))
r100_headers = ["Tier", "Video OFF", "Video ON"]
r100_widths = [4200, 2580, 2580]
r100_rows = [
    ["App instances (horizontal, ~4 GB each)", "2–3 x 4 GB", "4–6 x 4 GB"],
    ["PostgreSQL (dedicated, + PgBouncer pool)", "~8 GB", "~16 GB"],
    ["Load balancer", "Yes", "Yes"],
    ["Background video worker / queue", "—", "Recommended"],
    ["Total fleet RAM (approx)", "~16–20 GB", "~32–40 GB"],
]
parts.append(table(r100_headers, r100_rows, r100_widths))
parts.append(para("Recommended architecture: Video OFF -> 2-3 app instances (4 GB each) + load balancer + managed Postgres 8 GB + object storage for images (~$40-80/mo total infra). Video ON -> 4-6 app instances + managed Postgres 16 GB + object storage + a background worker for video polling (~$90-160/mo). Move video polling off the request path so long jobs don't pin app RAM.",
                  size=18, color="555555", space_after=160))

parts.append(para("Chat-only storage detail (100k users)", bold=True, size=20, color="333333", space_after=40))
parts.append(para("Chat lives in two Postgres tables (chat_threads + chat_messages); messages dominate. This is DISK, not RAM — queries are per-user/per-thread and indexed, so RAM to serve chat is far smaller than the data. Per-message row ~1 KB (id + thread_id + role + model + timestamps + diagnostics JSONB + content). Content size is the main driver.",
                  size=18, space_after=100))
c100_headers = ["Usage level", "Msgs/user (avg)", "Chat storage (100k users)"]
c100_widths = [3120, 3120, 3120]
c100_rows = [
    ["Light", "~50", "~6–8 GB"],
    ["Moderate (typical)", "~200", "~25–30 GB"],
    ["Heavy / engaged", "~500", "~60–70 GB"],
]
parts.append(table(c100_headers, c100_rows, c100_widths))
parts.append(para("Formula: storage_GB ~= (users x msgs_per_user x avg_KB_per_msg x 1.3) / 1,000,000. The 1.3 covers indexes + bloat. If assistant replies average 2-3 KB (long code blocks) instead of ~1 KB, double these numbers.",
                  size=16, color="777777", space_after=80))
parts.append(para("Takeaway: 100k users' chat = ~25-30 GB typical (max ~70 GB). Chat is NOT the storage problem — generated images (MB per file) are. Postgres needs only ~2-4 GB RAM to serve 100k users' chat because each request touches one user's threads via index.",
                  bold=True, size=18, color="1F6F4A", space_after=200))

# ---------- Cost-effective summary ----------
parts.append(heading("8. Cost-effective summary"))
sum_headers = ["Setup", "Fixed /mo", "Best for", "Effort"]
sum_widths = [3000, 1400, 3200, 1760]
sum_rows = [
    ["Hetzner VPS + self-hosted Postgres", "~$5", "Lowest cost, full control, no workarounds", "High"],
    ["Railway/Render + Neon", "~$12–15", "Best price/ease balance, zero refactor", "Low"],
    ["Vercel Pro + Neon + R2", "~$25+", "Max scale & DX, willing to refactor", "Medium"],
]
parts.append(table(sum_headers, sum_rows, sum_widths))

parts.append(heading("Recommendation", size=24))
parts.append(para(
    "Most cost-effective: run the app on a single Hetzner CX22 VPS (~$4.50/mo, "
    "2 vCPU / 4 GB RAM / 40 GB SSD) with PostgreSQL on the same box, Nginx + "
    "free Let's Encrypt SSL, and PM2/systemd keeping Next.js alive. It is the "
    "cheapest option AND the best technical fit: the persistent disk and "
    "unlimited request duration natively support the app's local image storage "
    "and long video jobs — no object storage or worker refactor needed. Total "
    "fixed cost ~$5/mo plus a ~$12/yr domain; AI usage billed separately and "
    "capped by the app's built-in per-provider USD budgets.",
    size=19, space_after=120))
parts.append(para(
    "Pick Railway/Render + Neon (~$12–15/mo) if you'd rather not manage a Linux "
    "server. Reserve Vercel for aggressive autoscaling once images move to R2 and "
    "video polling moves to a background worker.",
    size=19, color="555555"))

body_xml = "".join(parts)
sect = ('<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>'
        '<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" '
        'w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>')
document = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<w:document xmlns:w="{W}"><w:body>{body_xml}{sect}</w:body></w:document>')

content_types = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                 '<Default Extension="xml" ContentType="application/xml"/>'
                 '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
                 '</Types>')
rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '</Relationships>')

out = "AriamindX_Deployment_Full_v2.docx"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/document.xml", document)
print("Wrote", out)
