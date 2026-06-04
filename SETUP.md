# Aion Mind — Setup Guide (Fresh Windows System)

Complete walkthrough to run this app on a new machine, from installing VS Code
to `npm run dev`.

> **This is a Next.js / TypeScript app** — it uses **Node.js + npm**, not Python.
> Ignore any `requirements.txt` / `pip` instructions; the real dependency
> manifest is `package.json`.

---

## 1. Install VS Code
- Download: https://code.visualstudio.com → **Download for Windows**
- Run the installer; **check "Add to PATH"**.

## 2. Install Node.js (provides `npm`)
- Download the **LTS** build: https://nodejs.org
- Run the `.msi`, accept defaults, **keep "Add to PATH" checked**.
- **Close and reopen** your terminal so PATH refreshes.
- Verify in a new PowerShell window:
  ```powershell
  node --version
  npm --version
  ```
  Both must print a version. If `node` works but `npm` doesn't, fully close
  and reopen PowerShell (PATH needs a fresh shell). As a fallback you can call
  npm by full path: `& "C:\Program Files\nodejs\npm.cmd" install`.

## 3. Copy the project folder
- Copy the folder that **directly contains `package.json`** (app/, services/, etc.).
- Tip: delete `node_modules` before copying and reinstall fresh (step 5).
- **Include `.env`** (DB + API keys). Copy it only to trusted machines; never
  commit it to a public repo.

## 4. Open in VS Code
- **File → Open Folder** → select the project folder.
- Open a terminal: **Terminal → New Terminal** (`` Ctrl+` ``).

## 5. Install dependencies
```powershell
npm install
```

## 6. Configure `.env`
Must sit in the **same folder as `package.json`**. Copy `.env.example` to `.env`
if it doesn't exist, then fill in:

```ini
# --- Database (Supabase = cloud Postgres; NO local PostgreSQL install needed) ---
# The app's split config (AION_PG_*) is checked before DATABASE_URL and avoids
# URL-encoding special password characters.
AION_PG_HOST=db.YOUR-PROJECT-REF.supabase.co   # or aws-0-<region>.pooler.supabase.com
AION_PG_PORT=5432
AION_PG_DATABASE=postgres
AION_PG_USER=postgres                           # or postgres.<project-ref> for the pooler
AION_PG_PASSWORD=your-supabase-db-password
AION_PG_SSL=true                                # Supabase requires SSL

# --- At least one AI provider key ---
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# DEEPSEEK_API_KEY=...
# GEMINI_API_KEY=...
# GROK_API_KEY=...
```

Notes:
- **No PostgreSQL install required** — Supabase is cloud-hosted and reachable
  from any machine with the connection details. Multiple machines using the
  same values share the same database.
- The app auto-creates its tables on first connect (`CREATE TABLE IF NOT
  EXISTS` in `services/db.ts`) — you do **not** need `prisma migrate`.
- If the direct host fails to connect (some networks are IPv6-only for it),
  switch to the Supabase **Session pooler**: host
  `aws-0-<region>.pooler.supabase.com`, port `5432`, user
  `postgres.YOUR-PROJECT-REF`, same password.

## 7. Run the app
```powershell
npm run dev
```
Open http://localhost:3000

---

## Common scripts
| Command            | What it does                          |
|--------------------|---------------------------------------|
| `npm run dev`      | Start dev server (http://localhost:3000) |
| `npm run build`    | Production build                      |
| `npm start`        | Run the production build              |
| `npm run typecheck`| Type-check with `tsc --noEmit`        |

## Troubleshooting
- **`npm` not recognized** → Node not on PATH. Reopen terminal, or run
  `[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\nodejs", "User")` then open a fresh terminal.
- **`ENOENT ... package.json`** → you're in the wrong folder. `cd` into the
  folder that directly contains `package.json`.
- **DB connection errors** → re-check `AION_PG_*` values and `AION_PG_SSL=true`;
  set `AION_DEBUG=true` in `.env` for verbose logs.
