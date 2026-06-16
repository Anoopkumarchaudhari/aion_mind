import { AuthError, normalizeEmail, requireCurrentUser, type AuthUser } from "@/services/auth";
import { isDatabaseConfigured, query } from "@/services/db";

export const ADMIN_PANEL_PATH = "/aria-admin-vault";
const ADMIN_EMAILS_ENV = "AION_ADMIN_EMAILS";

export type AdminRole = "super" | "sub";

export type AdminUser = AuthUser & {
  adminEmailSource: string;
  role: AdminRole;
  isSuperAdmin: boolean;
};

export type AdminMember = {
  email: string;
  role: AdminRole;
  isSuperAdmin: boolean;
  addedBy: string | null;
  createdAt: number | null;
  isCurrentUser: boolean;
};

export async function requireAdminUser(): Promise<AdminUser> {
  const user = await requireCurrentUser();
  const email = normalizeEmail(user.email);
  const superEmails = getConfiguredAdminEmails();

  if (superEmails.length === 0) {
    throw new AuthError(`Admin access is not configured. Set ${ADMIN_EMAILS_ENV} in .env.`, 403);
  }

  const isSuper = superEmails.includes(email);
  const isSub = !isSuper && (await isSubAdmin(email));

  if (!isSuper && !isSub) {
    throw new AuthError("Admin access denied.", 404);
  }

  return {
    ...user,
    adminEmailSource: ADMIN_EMAILS_ENV,
    role: isSuper ? "super" : "sub",
    isSuperAdmin: isSuper
  };
}

/** Require a primary (env-allowlisted) admin. Sub-admins are rejected. */
export async function requireSuperAdmin(): Promise<AdminUser> {
  const admin = await requireAdminUser();

  if (!admin.isSuperAdmin) {
    throw new AuthError("Only a primary admin can manage admins.", 403);
  }

  return admin;
}

export function isAdminAccessConfigured() {
  return getConfiguredAdminEmails().length > 0;
}

export function getAdminAccessSummary() {
  const emails = getConfiguredAdminEmails();

  return {
    configured: emails.length > 0,
    envName: ADMIN_EMAILS_ENV,
    allowedCount: emails.length
  };
}

/* -------------------------------------------------------------------------- */
/* Sub-admins (DB-backed)                                                     */
/* -------------------------------------------------------------------------- */

export async function isSubAdmin(email: string) {
  if (!isDatabaseConfigured()) {
    return false;
  }

  try {
    const result = await query("SELECT email FROM admin_members WHERE email = $1", [normalizeEmail(email)]);
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function addSubAdmin(email: string, addedBy: string) {
  const clean = normalizeEmail(email);

  if (!isValidEmail(clean)) {
    throw new AuthError("Enter a valid email address.");
  }

  if (getConfiguredAdminEmails().includes(clean)) {
    throw new AuthError("That email is already a primary admin.");
  }

  if (await isSubAdmin(clean)) {
    throw new AuthError("That email is already a sub-admin.");
  }

  await query(
    `INSERT INTO admin_members (email, added_by, created_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    [clean, normalizeEmail(addedBy), Date.now()]
  );

  return clean;
}

export async function removeSubAdmin(email: string) {
  const clean = normalizeEmail(email);

  if (getConfiguredAdminEmails().includes(clean)) {
    throw new AuthError("Primary admins cannot be removed here.", 400);
  }

  const result = await query("DELETE FROM admin_members WHERE email = $1", [clean]);

  // Revoke any 2FA password/codes/sessions so access ends immediately.
  await query("DELETE FROM admin_credentials WHERE email = $1", [clean]);
  await query("DELETE FROM admin_login_codes WHERE email = $1", [clean]);
  await query("DELETE FROM admin_sessions WHERE email = $1", [clean]);

  if (!result.rowCount) {
    throw new AuthError("Sub-admin not found.", 404);
  }

  return clean;
}

export async function listAdminMembers(currentEmail: string): Promise<AdminMember[]> {
  const current = normalizeEmail(currentEmail);
  const superMembers: AdminMember[] = getConfiguredAdminEmails().map((email) => ({
    email,
    role: "super",
    isSuperAdmin: true,
    addedBy: null,
    createdAt: null,
    isCurrentUser: email === current
  }));

  let subMembers: AdminMember[] = [];

  if (isDatabaseConfigured()) {
    try {
      const result = await query<{ email: string; added_by: string | null; created_at: string | number }>(
        "SELECT email, added_by, created_at FROM admin_members ORDER BY created_at ASC"
      );
      subMembers = result.rows.map((row) => ({
        email: normalizeEmail(row.email),
        role: "sub",
        isSuperAdmin: false,
        addedBy: row.added_by ? normalizeEmail(row.added_by) : null,
        createdAt: Number(row.created_at) || null,
        isCurrentUser: normalizeEmail(row.email) === current
      }));
    } catch {
      subMembers = [];
    }
  }

  return [...superMembers, ...subMembers];
}

/** All emails (super + sub) that should be protected from user-account changes. */
export async function getAllAdminEmails(): Promise<Set<string>> {
  const subs = isDatabaseConfigured() ? await getSubAdminEmails() : [];
  return new Set([...getConfiguredAdminEmails(), ...subs]);
}

export function isSuperAdminEmail(email: string) {
  return getConfiguredAdminEmails().includes(normalizeEmail(email));
}

async function getSubAdminEmails(): Promise<string[]> {
  try {
    const result = await query<{ email: string }>("SELECT email FROM admin_members");
    return result.rows.map((row) => normalizeEmail(row.email));
  } catch {
    return [];
  }
}

function getConfiguredAdminEmails() {
  return [
    ...new Set([
      ...readEmailList(process.env.AION_ADMIN_EMAILS),
      ...readEmailList(process.env.AION_ADMIN_EMAIL)
    ])
  ];
}

function readEmailList(value: string | undefined) {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
    )
  ];
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
