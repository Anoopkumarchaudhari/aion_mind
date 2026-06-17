import { randomBytes, randomInt, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { AuthError, normalizeEmail } from "@/services/auth";
import { getDatabaseConfigIssue, query } from "@/services/db";
import { isEmailConfigured, sendPasswordResetCode } from "@/services/email";

/**
 * Forgot-password flow:
 *   1. requestPasswordReset() emails a 6-digit code to a registered address.
 *   2. verifyResetCode() confirms the code (without consuming it) so the UI can
 *      move to the reset screen.
 *   3. resetPassword() re-checks the code and updates the account password.
 *
 * Mirrors services/signupVerification.ts; email lives here (node-only) so the
 * shared auth module stays free of node-only deps.
 */

const scryptAsync = promisify(scrypt);

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const RESET_CODE_TTL_MINUTES = CODE_TTL_MS / 60_000;
const CODE_MAX_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 8;

export type ResetDelivery = "email" | "console";

type CodeRow = {
  code_hash: string;
  expires_at: string | number;
  attempts: number;
};

/** Issue a reset code for a registered email and deliver it. */
export async function requestPasswordReset(email: string): Promise<{ email: string; delivered: ResetDelivery }> {
  assertConfigured();

  const cleanEmail = normalizeEmail(email);
  validateEmail(cleanEmail);

  const user = await query<{ id: string }>("SELECT id FROM app_users WHERE email = $1", [cleanEmail]);

  if (!user.rowCount) {
    throw new AuthError("No account found with that email.", 404);
  }

  const code = generateCode();
  const now = Date.now();

  await query(
    `INSERT INTO password_reset_codes (email, code_hash, expires_at, attempts, created_at)
     VALUES ($1, $2, $3, 0, $4)
     ON CONFLICT (email) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, created_at = EXCLUDED.created_at`,
    [cleanEmail, await hashSecret(code), now + CODE_TTL_MS, now]
  );

  const delivered = await deliverCode(cleanEmail, code);
  return { email: cleanEmail, delivered };
}

/** Confirm the code is valid. Does NOT consume it — the reset step does that. */
export async function verifyResetCode(email: string, code: string): Promise<void> {
  assertConfigured();

  const cleanEmail = normalizeEmail(email);
  const row = await loadActiveCode(cleanEmail);

  if (!(await verifySecret(code.trim(), row.code_hash))) {
    await query("UPDATE password_reset_codes SET attempts = attempts + 1 WHERE email = $1", [cleanEmail]);
    throw new AuthError("Incorrect verification code.", 401);
  }
}

/** Re-check the code and update the account password, then clear the code. */
export async function resetPassword(email: string, code: string, password: string): Promise<void> {
  assertConfigured();

  const cleanEmail = normalizeEmail(email);
  validatePassword(password);

  const row = await loadActiveCode(cleanEmail);

  if (!(await verifySecret(code.trim(), row.code_hash))) {
    await query("UPDATE password_reset_codes SET attempts = attempts + 1 WHERE email = $1", [cleanEmail]);
    throw new AuthError("Incorrect verification code.", 401);
  }

  const user = await query<{ id: string }>("SELECT id FROM app_users WHERE email = $1", [cleanEmail]);

  if (!user.rowCount) {
    await clearCode(cleanEmail);
    throw new AuthError("No account found with that email.", 404);
  }

  await query("UPDATE app_users SET password_hash = $2 WHERE email = $1", [cleanEmail, await hashSecret(password)]);
  await clearCode(cleanEmail);
}

/** Load the code row, enforcing expiry and attempt limits. */
async function loadActiveCode(email: string): Promise<CodeRow> {
  const result = await query<CodeRow>(
    "SELECT code_hash, expires_at, attempts FROM password_reset_codes WHERE email = $1",
    [email]
  );
  const row = result.rows[0];

  if (!row) {
    throw new AuthError("No active reset code. Request a new one.", 404);
  }

  if (Number(row.expires_at) <= Date.now()) {
    await clearCode(email);
    throw new AuthError("Your code has expired. Request a new one.");
  }

  if (Number(row.attempts) >= CODE_MAX_ATTEMPTS) {
    await clearCode(email);
    throw new AuthError("Too many incorrect attempts. Request a new code.");
  }

  return row;
}

async function deliverCode(email: string, code: string): Promise<ResetDelivery> {
  if (isEmailConfigured()) {
    await sendPasswordResetCode(email, code, RESET_CODE_TTL_MINUTES);
    return "email";
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(`[password-reset] SMTP not configured. Reset code for ${email}: ${code}`);
    return "console";
  }

  throw new AuthError(
    "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env.",
    500
  );
}

async function clearCode(email: string) {
  await query("DELETE FROM password_reset_codes WHERE email = $1", [normalizeEmail(email)]);
}

function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("Enter a valid email address.");
  }
}

function validatePassword(password: string) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

function assertConfigured() {
  const configIssue = getDatabaseConfigIssue();

  if (configIssue) {
    throw new AuthError(configIssue, 500);
  }
}

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
