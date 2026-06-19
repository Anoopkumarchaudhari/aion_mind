import { getResolvedBillingCatalog } from "@/services/adminSettings";
import { AuthError } from "@/services/auth";
import { query } from "@/services/db";

export type AdminUserLedgerEntry = {
  id: string;
  kind: string;
  featureId: string | null;
  label: string;
  credits: number;
  balanceAfter: number;
  status: string;
  createdAt: number;
};

export type AdminUserPayment = {
  id: string;
  kind: string;
  itemLabel: string;
  amountInr: number;
  credits: number;
  planId: string | null;
  status: string;
  paymentId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type AdminUserSession = {
  id: string;
  createdAt: number;
  expiresAt: number;
  active: boolean;
};

export type AdminUserDetail = {
  profile: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    role: string;
    planId: string;
    credits: number;
    avatar: string | null;
    createdAt: number;
  };
  plan: {
    id: string;
    name: string;
    monthlyCredits: number;
    priceInr: number;
  };
  planOptions: Array<{ id: string; name: string; monthlyCredits: number; priceInr: number }>;
  stats: {
    threadCount: number;
    messageCount: number;
    activeSessions: number;
    totalSessions: number;
    lifetimeGranted: number;
    lifetimeSpent: number;
    lifetimePurchasedInr: number;
    paymentCount: number;
    successfulPayments: number;
    failedPayments: number;
    lastActiveAt: number | null;
  };
  usageByFeature: Array<{ featureId: string; label: string; credits: number; count: number }>;
  planHistory: Array<{ planId: string | null; label: string; amountInr: number; status: string; createdAt: number }>;
  payments: AdminUserPayment[];
  ledger: AdminUserLedgerEntry[];
  sessions: AdminUserSession[];
};

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  is_active: boolean | string;
  role: string | null;
  plan_id: string | null;
  credits: string | number | null;
  avatar: string | null;
  created_at: string | number;
};

const FEATURE_LABELS: Record<string, string> = {
  chat: "Chat",
  "file-chat": "File / image chat",
  research: "Aria Research",
  analyzer: "Aria Mind / Analyzer",
  translate: "Translate",
  image: "Image generation",
  video: "Video generation",
  audio: "Audio / podcast"
};

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const profileResult = await query<ProfileRow>(
    `SELECT id, name, email, is_active, role, plan_id, credits, avatar, created_at
     FROM app_users WHERE id = $1`,
    [userId]
  );
  const profile = profileResult.rows[0];

  if (!profile) {
    throw new AuthError("User not found.", 404);
  }

  const now = Date.now();

  const [ledgerRes, paymentsRes, sessionsRes, threadRes, messageRes] = await Promise.all([
    query<{
      id: string;
      kind: string;
      feature_id: string | null;
      label: string;
      credits: number;
      balance_after: number;
      status: string;
      created_at: string | number;
    }>(
      `SELECT id, kind, feature_id, label, credits, balance_after, status, created_at
       FROM credit_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [userId]
    ),
    query<{
      id: string;
      kind: string;
      item_label: string;
      amount_inr: number;
      credits: number;
      plan_id: string | null;
      status: string;
      payment_id: string | null;
      created_at: string | number;
      updated_at: string | number;
    }>(
      `SELECT id, kind, item_label, amount_inr, credits, plan_id, status, payment_id, created_at, updated_at
       FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [userId]
    ),
    query<{ id: string; created_at: string | number; expires_at: string | number }>(
      `SELECT id, created_at, expires_at FROM app_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    ),
    query<{ count: string | number }>("SELECT COUNT(*) AS count FROM chat_threads WHERE user_id = $1", [userId]),
    query<{ count: string | number }>(
      `SELECT COUNT(chat_messages.id) AS count
       FROM chat_threads
       LEFT JOIN chat_messages ON chat_messages.thread_id = chat_threads.id
       WHERE chat_threads.user_id = $1`,
      [userId]
    )
  ]);

  const ledger: AdminUserLedgerEntry[] = ledgerRes.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    featureId: row.feature_id,
    label: row.label,
    credits: num(row.credits),
    balanceAfter: num(row.balance_after),
    status: row.status,
    createdAt: num(row.created_at)
  }));

  const payments: AdminUserPayment[] = paymentsRes.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    itemLabel: row.item_label,
    amountInr: num(row.amount_inr),
    credits: num(row.credits),
    planId: row.plan_id,
    status: row.status,
    paymentId: row.payment_id,
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at)
  }));

  const sessions: AdminUserSession[] = sessionsRes.rows.map((row) => ({
    id: row.id,
    createdAt: num(row.created_at),
    expiresAt: num(row.expires_at),
    active: num(row.expires_at) > now
  }));

  const lifetimeGranted = ledger.filter((e) => e.credits > 0).reduce((sum, e) => sum + e.credits, 0);
  const lifetimeSpent = ledger.filter((e) => e.credits < 0).reduce((sum, e) => sum - e.credits, 0);
  const paidPayments = payments.filter((p) => p.status === "paid");

  const usageMap = new Map<string, { credits: number; count: number }>();
  for (const entry of ledger) {
    if (entry.kind !== "usage") {
      continue;
    }
    const key = entry.featureId ?? "chat";
    const current = usageMap.get(key) ?? { credits: 0, count: 0 };
    current.credits += Math.abs(entry.credits);
    current.count += 1;
    usageMap.set(key, current);
  }

  const usageByFeature = Array.from(usageMap.entries())
    .map(([featureId, value]) => ({
      featureId,
      label: FEATURE_LABELS[featureId] ?? featureId,
      credits: value.credits,
      count: value.count
    }))
    .sort((a, b) => b.credits - a.credits);

  const planHistory = payments
    .filter((p) => p.kind === "plan")
    .map((p) => ({
      planId: p.planId,
      label: p.itemLabel,
      amountInr: p.amountInr,
      status: p.status,
      createdAt: p.createdAt
    }));

  const planId = profile.plan_id ?? "free";
  const catalog = await getResolvedBillingCatalog();
  const planMeta = catalog.plans.find((plan) => plan.id === planId);

  return {
    plan: {
      id: planId,
      name: planMeta?.name ?? planId,
      monthlyCredits: planMeta?.monthlyCredits ?? 0,
      priceInr: planMeta?.priceInr ?? 0
    },
    planOptions: catalog.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      monthlyCredits: plan.monthlyCredits,
      priceInr: plan.priceInr
    })),
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      isActive: toBoolean(profile.is_active),
      role: profile.role ?? "member",
      planId: profile.plan_id ?? "free",
      credits: num(profile.credits),
      avatar: profile.avatar,
      createdAt: num(profile.created_at)
    },
    stats: {
      threadCount: num(threadRes.rows[0]?.count),
      messageCount: num(messageRes.rows[0]?.count),
      activeSessions: sessions.filter((s) => s.active).length,
      totalSessions: sessions.length,
      lifetimeGranted,
      lifetimeSpent,
      lifetimePurchasedInr: paidPayments.reduce((sum, p) => sum + p.amountInr, 0),
      paymentCount: payments.length,
      successfulPayments: paidPayments.length,
      failedPayments: payments.filter((p) => p.status !== "paid").length,
      lastActiveAt: sessions.length ? Math.max(...sessions.map((s) => s.createdAt)) : null
    },
    usageByFeature,
    planHistory,
    payments,
    ledger,
    sessions
  };
}

function num(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: boolean | string | number | null | undefined) {
  return value === true || value === "true" || value === "1" || value === 1;
}
