import { AuthError, normalizeEmail, requireCurrentUser, type AuthUser } from "@/services/auth";

export const ADMIN_PANEL_PATH = "/aria-admin-vault";
const ADMIN_EMAILS_ENV = "AION_ADMIN_EMAILS";

export type AdminUser = AuthUser & {
  adminEmailSource: string;
};

export async function requireAdminUser(): Promise<AdminUser> {
  const user = await requireCurrentUser();
  const adminEmails = getConfiguredAdminEmails();

  if (adminEmails.length === 0) {
    throw new AuthError(`Admin access is not configured. Set ${ADMIN_EMAILS_ENV} in .env.`, 403);
  }

  if (!adminEmails.includes(normalizeEmail(user.email))) {
    throw new AuthError("Admin access denied.", 404);
  }

  return {
    ...user,
    adminEmailSource: ADMIN_EMAILS_ENV
  };
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

function getConfiguredAdminEmails() {
  return [
    ...readEmailList(process.env.AION_ADMIN_EMAILS),
    ...readEmailList(process.env.AION_ADMIN_EMAIL)
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
