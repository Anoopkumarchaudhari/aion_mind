import { randomBytes, randomInt, randomUUID, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { normalizeEmail } from "@/services/auth";
import { isEmailConfigured, sendAdminLoginCode } from "@/services/email";
import { query } from "@/services/db";
import type { AdminUser } from "@/services/adminAuth";

const scryptAsync = promisify(scrypt);

export const ADMIN_SESSION_COOKIE = "aion_admin";
export const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const CODE_TTL_MINUTES = CODE_TTL_MS / 60_000;
const CODE_MAX_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 8;

/* -------------------------------------------------------------------------- */
/* Password (per-admin, DB-backed)                                            */
/* -------------------------------------------------------------------------- */

export async function hasAdminPassword(email: string) {
  const result = await query<{ email: string }>("SELECT email FROM admin_credentials WHERE email = $1", [
    normalizeEmail(email)
  ]);
  return result.rowCount ? true : false;
}

export async function setAdminPassword(email: string, password: string) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new AdminGateError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const now = Date.now();
  const hash = await hashSecret(password);

  await query(
    `INSERT INTO admin_credentials (email, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at`,
    [normalizeEmail(email), hash, now]
  );
}

export async function verifyAdminPassword(email: string, password: string) {
  const result = await query<{ password_hash: string }>(
    "SELECT password_hash FROM admin_credentials WHERE email = $1",
    [normalizeEmail(email)]
  );
  const row = result.rows[0];

  if (!row) {
    return false;
  }

  return verifySecret(password, row.password_hash);
}

/* -------------------------------------------------------------------------- */
/* Email verification codes                                                   */
/* -------------------------------------------------------------------------- */

/** Generate a 6-digit code, store its hash with a TTL, and return the plaintext to email. */
export async function issueLoginCode(email: string) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = Date.now();
  const codeHash = await hashSecret(code);

  await query(
    `INSERT INTO admin_login_codes (email, code_hash, expires_at, attempts, created_at)
     VALUES ($1, $2, $3, 0, $4)
     ON CONFLICT (email) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, created_at = EXCLUDED.created_at`,
    [normalizeEmail(email), codeHash, now + CODE_TTL_MS, now]
  );

  return code;
}

export async function verifyLoginCode(email: string, code: string): Promise<{ ok: boolean; reason?: string }> {
  const normalized = normalizeEmail(email);
  const result = await query<{ code_hash: string; expires_at: string | number; attempts: number }>(
    "SELECT code_hash, expires_at, attempts FROM admin_login_codes WHERE email = $1",
    [normalized]
  );
  const row = result.rows[0];

  if (!row) {
    return { ok: false, reason: "No active code. Request a new one." };
  }

  if (Number(row.expires_at) <= Date.now()) {
    await clearLoginCode(normalized);
    return { ok: false, reason: "Code expired. Request a new one." };
  }

  if (Number(row.attempts) >= CODE_MAX_ATTEMPTS) {
    await clearLoginCode(normalized);
    return { ok: false, reason: "Too many attempts. Request a new code." };
  }

  const valid = typeof code === "string" && (await verifySecret(code.trim(), row.code_hash));

  if (!valid) {
    await query("UPDATE admin_login_codes SET attempts = attempts + 1 WHERE email = $1", [normalized]);
    return { ok: false, reason: "Incorrect code." };
  }

  await clearLoginCode(normalized);
  return { ok: true };
}

async function clearLoginCode(email: string) {
  await query("DELETE FROM admin_login_codes WHERE email = $1", [normalizeEmail(email)]);
}

/**
 * Issue a code and deliver it. Uses SMTP when configured. In development, if
 * SMTP isn't set up yet, the code is logged to the server console so the flow
 * is testable; in production a missing SMTP config is a hard error.
 */
export async function dispatchAdminLoginCode(email: string): Promise<{ delivered: "email" | "console" }> {
  const normalized = normalizeEmail(email);
  const code = await issueLoginCode(normalized);

  if (isEmailConfigured()) {
    await sendAdminLoginCode(normalized, code, CODE_TTL_MINUTES);
    return { delivered: "email" };
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(`[admin-gate] SMTP not configured. Verification code for ${normalized}: ${code}`);
    return { delivered: "console" };
  }

  throw new AdminGateError(
    "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env.",
    500
  );
}

/* -------------------------------------------------------------------------- */
/* Admin 2FA sessions                                                         */
/* -------------------------------------------------------------------------- */

export async function createAdminSession(userId: string, email: string) {
  const id = randomUUID();
  const now = Date.now();

  await query(
    `INSERT INTO admin_sessions (id, user_id, email, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, normalizeEmail(email), now + ADMIN_SESSION_TTL_MS, now]
  );

  return id;
}

export async function hasValidAdminSession(userId: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!sessionId) {
    return false;
  }

  const result = await query<{ user_id: string; expires_at: string | number }>(
    "SELECT user_id, expires_at FROM admin_sessions WHERE id = $1",
    [sessionId]
  );
  const row = result.rows[0];

  if (!row || row.user_id !== userId) {
    return false;
  }

  if (Number(row.expires_at) <= Date.now()) {
    await deleteAdminSession(sessionId);
    return false;
  }

  return true;
}

export async function deleteCurrentAdminSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  await deleteAdminSession(sessionId);
}

export async function deleteAdminSession(sessionId: string | undefined) {
  if (!sessionId) {
    return;
  }

  await query("DELETE FROM admin_sessions WHERE id = $1", [sessionId]);
}

export function setAdminSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000)
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

/* -------------------------------------------------------------------------- */
/* Page gate state                                                            */
/* -------------------------------------------------------------------------- */

export type AdminGateState = {
  hasPassword: boolean;
  unlocked: boolean;
  email: string;
  emailMasked: string;
  emailConfigured: boolean;
};

export async function getAdminGateState(admin: AdminUser): Promise<AdminGateState> {
  const email = normalizeEmail(admin.email);
  const [hasPassword, unlocked] = await Promise.all([hasAdminPassword(email), hasValidAdminSession(admin.id)]);

  return {
    hasPassword,
    unlocked,
    email,
    emailMasked: maskEmail(email),
    emailConfigured: isEmailConfigured()
  };
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");

  if (!domain) {
    return email;
  }

  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

/* -------------------------------------------------------------------------- */
/* Hashing helpers                                                            */
/* -------------------------------------------------------------------------- */

async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(secret, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

async function verifySecret(secret: string, stored: string) {
  const [algorithm, salt, key] = stored.split(":");

  if (algorithm !== "scrypt" || !salt || !key) {
    return false;
  }

  const derivedKey = (await scryptAsync(secret, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

export class AdminGateError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminGateError";
    this.status = status;
  }
}
