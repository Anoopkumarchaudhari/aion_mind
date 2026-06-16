import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP email transport. Configured entirely from env so no credentials live in
 * code. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * Optional: SMTP_SECURE ("true" for implicit TLS / port 465).
 */

const transporterKey = "__aionMindMailTransporter";

type GlobalWithTransporter = typeof globalThis & {
  [transporterKey]?: { transporter: Transporter; signature: string };
};

const globalStore = globalThis as GlobalWithTransporter;

export type EmailConfigState = {
  configured: boolean;
  missing: string[];
};

const REQUIRED_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;

export function getEmailConfigState(): EmailConfigState {
  const missing = REQUIRED_KEYS.filter((key) => !readEnv(key));
  return { configured: missing.length === 0, missing: [...missing] };
}

export function isEmailConfigured() {
  return getEmailConfigState().configured;
}

function getTransporter(): Transporter {
  const host = readEnv("SMTP_HOST");
  const port = Number(readEnv("SMTP_PORT") || "587");
  const user = readEnv("SMTP_USER");
  const pass = readEnv("SMTP_PASS");
  const secure = readBooleanEnv("SMTP_SECURE") || port === 465;
  const signature = `${host}:${port}:${user}:${secure}`;

  if (!globalStore[transporterKey] || globalStore[transporterKey].signature !== signature) {
    globalStore[transporterKey] = {
      signature,
      transporter: nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
      })
    };
  }

  return globalStore[transporterKey].transporter;
}

export async function sendEmail({
  to,
  subject,
  text,
  html
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const state = getEmailConfigState();

  if (!state.configured) {
    throw new Error(`Email is not configured. Set ${state.missing.join(", ")} in .env.`);
  }

  await getTransporter().sendMail({
    from: readEnv("SMTP_FROM"),
    to,
    subject,
    text,
    html
  });
}

export async function sendAdminLoginCode(to: string, code: string, ttlMinutes: number) {
  const subject = "Your AriamindX admin verification code";
  const text = `Your AriamindX admin verification code is ${code}. It expires in ${ttlMinutes} minutes. If you did not request this, ignore this email.`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px">AriamindX admin sign-in</h2>
      <p style="margin:0 0 16px;color:#475569">Use this verification code to finish signing in to the admin control center.</p>
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;padding:16px 0;text-align:center;background:#f1f5f9;border-radius:12px">${code}</div>
      <p style="margin:16px 0 0;color:#64748b;font-size:13px">This code expires in ${ttlMinutes} minutes. If you didn't request it, you can ignore this email.</p>
    </div>
  `;

  await sendEmail({ to, subject, text, html });
}

function readEnv(key: string) {
  return process.env[key]?.trim() ?? "";
}

function readBooleanEnv(key: string) {
  return ["1", "true", "yes"].includes(readEnv(key).toLowerCase());
}
