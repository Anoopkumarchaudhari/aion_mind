import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDatabaseConfigIssue, isDatabaseConfigured, query } from "@/services/db";
import { ensureInitialCredits } from "@/services/credits";

const scryptAsync = promisify(scrypt);
export const SESSION_COOKIE = "aion_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  is_active: boolean | string;
};

type SessionUserRow = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  expires_at: string | number;
  is_active: boolean | string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function signupUser({
  name,
  email,
  password
}: {
  name: string;
  email: string;
  password: string;
}) {
  assertAuthConfigured();

  const cleanName = name.trim().slice(0, 80);
  const cleanEmail = normalizeEmail(email);

  if (cleanName.length < 2) {
    throw new AuthError("Name must be at least 2 characters.");
  }

  validateEmail(cleanEmail);
  validatePassword(password);

  const existing = await query<{ id: string }>("SELECT id FROM app_users WHERE email = $1", [
    cleanEmail
  ]);

  if (existing.rowCount) {
    throw new AuthError("An account with this email already exists.");
  }

  const user: AuthUser = {
    id: randomUUID(),
    name: cleanName,
    email: cleanEmail
  };

  await query(
    `INSERT INTO app_users (id, name, email, password_hash, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, user.name, user.email, await hashPassword(password), Date.now()]
  );

  await ensureInitialCredits(user.id);

  return user;
}

export async function loginUser(email: string, password: string) {
  assertAuthConfigured();

  const cleanEmail = normalizeEmail(email);
  const result = await query<UserRow>(
    "SELECT id, name, email, password_hash, is_active FROM app_users WHERE email = $1",
    [cleanEmail]
  );
  const user = result.rows[0];

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new AuthError("Invalid email or password.");
  }

  if (!toBoolean(user.is_active)) {
    throw new AuthError("This account is inactive. Contact the administrator.", 403);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

export async function createSession(userId: string) {
  assertAuthConfigured();

  const sessionId = randomUUID();
  const now = Date.now();

  await query(
    `INSERT INTO app_sessions (id, user_id, expires_at, created_at)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, userId, now + SESSION_TTL_MS, now]
  );

  return sessionId;
}

export async function getUserFromSession(sessionId: string | undefined) {
  if (!sessionId || !isDatabaseConfigured()) {
    return null;
  }

  const result = await query<SessionUserRow>(
    `SELECT app_users.id, app_users.name, app_users.email, app_users.avatar, app_users.is_active, app_sessions.expires_at
     FROM app_sessions
     INNER JOIN app_users ON app_users.id = app_sessions.user_id
     WHERE app_sessions.id = $1`,
    [sessionId]
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  if (!toBoolean(row.is_active)) {
    await deleteSession(sessionId);
    return null;
  }

  if (Number(row.expires_at) <= Date.now()) {
    await deleteSession(sessionId);
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar
  };
}

/** Update the signed-in user's editable profile fields (display name + avatar). */
export async function updateUserProfile(
  userId: string,
  changes: { name?: string; avatar?: string }
): Promise<AuthUser> {
  assertAuthConfigured();

  const sets: string[] = [];
  const params: unknown[] = [userId];

  if (typeof changes.name === "string") {
    const cleanName = changes.name.trim().slice(0, 80);

    if (cleanName.length < 2) {
      throw new AuthError("Name must be at least 2 characters.");
    }

    params.push(cleanName);
    sets.push(`name = $${params.length}`);
  }

  if (typeof changes.avatar === "string") {
    params.push(changes.avatar.trim().slice(0, 40));
    sets.push(`avatar = $${params.length}`);
  }

  if (sets.length === 0) {
    throw new AuthError("No profile changes were provided.");
  }

  const result = await query<{ id: string; name: string; email: string; avatar: string | null }>(
    `UPDATE app_users SET ${sets.join(", ")} WHERE id = $1
     RETURNING id, name, email, avatar`,
    params
  );
  const row = result.rows[0];

  if (!row) {
    throw new AuthError("User not found.", 404);
  }

  return { id: row.id, name: row.name, email: row.email, avatar: row.avatar };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return getUserFromSession(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthError("You must be signed in.", 401);
  }

  return user;
}

export async function deleteSession(sessionId: string | undefined) {
  if (!sessionId || !isDatabaseConfigured()) {
    return;
  }

  await query("DELETE FROM app_sessions WHERE id = $1", [sessionId]);
}

export function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000)
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, key] = stored.split(":");

  if (algorithm !== "scrypt" || !salt || !key) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("Enter a valid email address.");
  }
}

function validatePassword(password: string) {
  if (password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.");
  }
}

function toBoolean(value: boolean | string | number | null | undefined) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function assertAuthConfigured() {
  const configIssue = getDatabaseConfigIssue();

  if (configIssue) {
    throw new AuthError(configIssue, 500);
  }
}
