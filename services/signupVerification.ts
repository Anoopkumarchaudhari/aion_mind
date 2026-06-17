import { randomBytes, randomInt, randomUUID, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { AuthError, normalizeEmail, type AuthUser } from "@/services/auth";
import { getDatabaseConfigIssue, query } from "@/services/db";
import { isEmailConfigured, sendSignupCode } from "@/services/email";

/**
 * Two-step (email-verified) signup.
 *
 * 1. requestSignupCode() validates the details, stores a *pending* signup
 *    (name + password hash) plus a hashed 6-digit code, then emails the code.
 *    No row is added to app_users yet.
 * 2. confirmSignup() checks the code and, only on success, creates the real
 *    user account.
 *
 * Email (nodemailer) is imported here rather than in auth.ts so the shared
 * auth module stays free of node-only transitive deps.
 */

const scryptAsync = promisify(scrypt);

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const SIGNUP_CODE_TTL_MINUTES = CODE_TTL_MS / 60_000;
const CODE_MAX_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 8;

export type SignupDelivery = "email" | "console";

type PendingRow = {
  name: string;
  password_hash: string;
  code_hash: string;
  expires_at: string | number;
  attempts: number;
};

/** Validate details, store the pending signup with a fresh code, and deliver it. */
export async function requestSignupCode({
  name,
  email,
  password
}: {
  name: string;
  email: string;
  password: string;
}): Promise<{ email: string; delivered: SignupDelivery }> {
  assertConfigured();

  const cleanName = name.trim().slice(0, 80);
  const cleanEmail = normalizeEmail(email);

  if (cleanName.length < 2) {
    throw new AuthError("Name must be at least 2 characters.");
  }

  validateEmail(cleanEmail);
  validatePassword(password);

  const existing = await query<{ id: string }>("SELECT id FROM app_users WHERE email = $1", [cleanEmail]);

  if (existing.rowCount) {
    throw new AuthError("An account with this email already exists.");
  }

  const code = generateCode();
  const now = Date.now();

  await query(
    `INSERT INTO signup_verifications (email, name, password_hash, code_hash, expires_at, attempts, created_at)
     VALUES ($1, $2, $3, $4, $5, 0, $6)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           code_hash = EXCLUDED.code_hash,
           expires_at = EXCLUDED.expires_at,
           attempts = 0,
           created_at = EXCLUDED.created_at`,
    [cleanEmail, cleanName, await hashSecret(password), await hashSecret(code), now + CODE_TTL_MS, now]
  );

  const delivered = await deliverCode(cleanEmail, code);
  return { email: cleanEmail, delivered };
}

/** Re-issue and resend a code for an existing pending signup. */
export async function resendSignupCode(email: string): Promise<{ email: string; delivered: SignupDelivery }> {
  assertConfigured();

  const cleanEmail = normalizeEmail(email);
  const result = await query<{ name: string }>("SELECT name FROM signup_verifications WHERE email = $1", [
    cleanEmail
  ]);

  if (!result.rowCount) {
    throw new AuthError("No pending signup found. Please register again.", 404);
  }

  const code = generateCode();
  const now = Date.now();

  await query(
    "UPDATE signup_verifications SET code_hash = $2, expires_at = $3, attempts = 0, created_at = $4 WHERE email = $1",
    [cleanEmail, await hashSecret(code), now + CODE_TTL_MS, now]
  );

  const delivered = await deliverCode(cleanEmail, code);
  return { email: cleanEmail, delivered };
}

/** Verify the code and, on success, create the real user account. */
export async function confirmSignup(email: string, code: string): Promise<AuthUser> {
  assertConfigured();

  const cleanEmail = normalizeEmail(email);
  const result = await query<PendingRow>(
    "SELECT name, password_hash, code_hash, expires_at, attempts FROM signup_verifications WHERE email = $1",
    [cleanEmail]
  );
  const row = result.rows[0];

  if (!row) {
    throw new AuthError("No pending signup found. Please register again.", 404);
  }

  if (Number(row.expires_at) <= Date.now()) {
    await clearVerification(cleanEmail);
    throw new AuthError("Your code has expired. Please register again.");
  }

  if (Number(row.attempts) >= CODE_MAX_ATTEMPTS) {
    await clearVerification(cleanEmail);
    throw new AuthError("Too many incorrect attempts. Please register again.");
  }

  const valid = typeof code === "string" && (await verifySecret(code.trim(), row.code_hash));

  if (!valid) {
    await query("UPDATE signup_verifications SET attempts = attempts + 1 WHERE email = $1", [cleanEmail]);
    throw new AuthError("Incorrect verification code.", 401);
  }

  // Guard against a race where the email got registered between request and confirm.
  const existing = await query<{ id: string }>("SELECT id FROM app_users WHERE email = $1", [cleanEmail]);

  if (existing.rowCount) {
    await clearVerification(cleanEmail);
    throw new AuthError("An account with this email already exists.");
  }

  const user: AuthUser = {
    id: randomUUID(),
    name: row.name,
    email: cleanEmail
  };

  await query(
    `INSERT INTO app_users (id, name, email, password_hash, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, user.name, user.email, row.password_hash, Date.now()]
  );

  await clearVerification(cleanEmail);
  return user;
}

async function deliverCode(email: string, code: string): Promise<SignupDelivery> {
  if (isEmailConfigured()) {
    await sendSignupCode(email, code, SIGNUP_CODE_TTL_MINUTES);
    return "email";
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(`[signup] SMTP not configured. Verification code for ${email}: ${code}`);
    return "console";
  }

  throw new AuthError(
    "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env.",
    500
  );
}

async function clearVerification(email: string) {
  await query("DELETE FROM signup_verifications WHERE email = $1", [normalizeEmail(email)]);
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
