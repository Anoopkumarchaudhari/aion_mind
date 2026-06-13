import { BILLING_PLANS, BILLING_TOP_UP_PACKS, FEATURE_CREDIT_RATES } from "@/services/billingCatalog";
import { getAionRoutingPayload } from "@/services/aionRoutingConfig";
import { getAdminAccessSummary, type AdminUser } from "@/services/adminAuth";
import { AuthError } from "@/services/auth";
import { getDatabaseConfigIssue, isDatabaseConfigured, query } from "@/services/db";
import type { AionRouteSlot } from "@/types/aionRouting";

type CountRow = {
  count: string | number;
};

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  is_active: boolean | string;
  created_at: string | number;
  thread_count: string | number;
  message_count: string | number;
  active_sessions: string | number;
};

export type AdminOverview = {
  generatedAt: string;
  admin: {
    id: string;
    name: string;
    email: string;
  };
  database: {
    configured: boolean;
    issue: string | null;
  };
  stats: {
    users: number | null;
    activeUsers: number | null;
    activeSessions: number | null;
    chatThreads: number | null;
    chatMessages: number | null;
  };
  users: Array<{
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    createdAt: number;
    threadCount: number;
    messageCount: number;
    activeSessions: number;
    isCurrentAdmin: boolean;
  }>;
  providers: Array<{
    id: string;
    label: string;
    apiKeyConfigured: boolean;
    modelCount: number;
  }>;
  routing: Array<{
    label: string;
    slots: Array<Pick<AionRouteSlot, "id" | "label" | "provider" | "model" | "enabled">>;
  }>;
  billing: {
    plans: typeof BILLING_PLANS;
    topUps: typeof BILLING_TOP_UP_PACKS;
    featureRates: typeof FEATURE_CREDIT_RATES;
  };
  config: Array<{
    label: string;
    status: "ready" | "missing";
    detail: string;
  }>;
};

export async function getAdminOverview(admin: AdminUser): Promise<AdminOverview> {
  const [routingPayload, databaseSnapshot] = await Promise.all([
    getAionRoutingPayload(),
    getDatabaseSnapshot(admin.id)
  ]);
  const adminAccess = getAdminAccessSummary();

  return {
    generatedAt: new Date().toISOString(),
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email
    },
    database: {
      configured: isDatabaseConfigured(),
      issue: getDatabaseConfigIssue()
    },
    stats: databaseSnapshot.stats,
    users: databaseSnapshot.users,
    providers: routingPayload.providerStatus.map((provider) => ({
      id: provider.id,
      label: provider.label,
      apiKeyConfigured: provider.apiKeyConfigured,
      modelCount: provider.defaultModels.filter((model) => model.value).length
    })),
    routing: [
      { label: "Aria Mind", slots: [toAdminSlot(routingPayload.settings.aion.primary)] },
      {
        label: "Aria Research",
        slots: [...routingPayload.settings.pro.candidates, routingPayload.settings.pro.judge].map(toAdminSlot)
      },
      {
        label: "Aria Analyzer",
        slots: [...routingPayload.settings.analyzer.candidates, routingPayload.settings.analyzer.judge].map(
          toAdminSlot
        )
      }
    ],
    billing: {
      plans: BILLING_PLANS,
      topUps: BILLING_TOP_UP_PACKS,
      featureRates: FEATURE_CREDIT_RATES
    },
    config: [
      {
        label: "Database",
        status: isDatabaseConfigured() ? "ready" : "missing",
        detail: isDatabaseConfigured() ? "PostgreSQL connected" : getDatabaseConfigIssue() ?? "Not configured"
      },
      {
        label: "Admin allowlist",
        status: adminAccess.configured ? "ready" : "missing",
        detail: adminAccess.configured
          ? `${adminAccess.allowedCount} admin email${adminAccess.allowedCount === 1 ? "" : "s"}`
          : `Set ${adminAccess.envName}`
      },
      {
        label: "OpenAI costs",
        status: readEnv("OPENAI_ADMIN_API_KEY") ? "ready" : "missing",
        detail: readEnv("OPENAI_ADMIN_API_KEY") ? "Admin cost API enabled" : "Set OPENAI_ADMIN_API_KEY"
      },
      {
        label: "Provider budgets",
        status: hasAnyBudgetEnv() ? "ready" : "missing",
        detail: hasAnyBudgetEnv() ? "Budget env values found" : "Set provider budget env values"
      }
    ]
  };
}

export async function revokeUserSessions(userId: string) {
  const result = await query("DELETE FROM app_sessions WHERE user_id = $1", [userId]);
  return result.rowCount ?? 0;
}

export async function setUserActiveStatus(userId: string, isActive: boolean) {
  const result = await query<{ id: string; is_active: boolean | string }>(
    "UPDATE app_users SET is_active = $2 WHERE id = $1 RETURNING id, is_active",
    [userId, isActive]
  );
  const user = result.rows[0];

  if (!user) {
    throw new AuthError("User not found.", 404);
  }

  const revoked = isActive ? 0 : await revokeUserSessions(userId);

  return {
    user: {
      id: user.id,
      isActive: toBoolean(user.is_active)
    },
    revoked
  };
}

async function getDatabaseSnapshot(currentAdminId: string) {
  const emptySnapshot = {
    stats: {
      users: null,
      activeUsers: null,
      activeSessions: null,
      chatThreads: null,
      chatMessages: null
    },
    users: []
  };

  if (!isDatabaseConfigured()) {
    return emptySnapshot;
  }

  try {
    const now = Date.now();
    const [usersCount, activeUsersCount, sessionsCount, threadsCount, messagesCount, users] = await Promise.all([
      getCount("SELECT COUNT(*) AS count FROM app_users"),
      getCount("SELECT COUNT(*) AS count FROM app_users WHERE is_active = TRUE"),
      getCount("SELECT COUNT(*) AS count FROM app_sessions WHERE expires_at > $1", [now]),
      getCount("SELECT COUNT(*) AS count FROM chat_threads"),
      getCount("SELECT COUNT(*) AS count FROM chat_messages"),
      query<AdminUserRow>(
        `
          SELECT
            app_users.id,
            app_users.name,
            app_users.email,
            app_users.is_active,
            app_users.created_at,
            COALESCE(thread_counts.thread_count, 0)::int AS thread_count,
            COALESCE(message_counts.message_count, 0)::int AS message_count,
            COALESCE(session_counts.active_sessions, 0)::int AS active_sessions
          FROM app_users
          LEFT JOIN (
            SELECT user_id, COUNT(*)::int AS thread_count
            FROM chat_threads
            GROUP BY user_id
          ) thread_counts ON thread_counts.user_id = app_users.id
          LEFT JOIN (
            SELECT chat_threads.user_id, COUNT(chat_messages.id)::int AS message_count
            FROM chat_threads
            LEFT JOIN chat_messages ON chat_messages.thread_id = chat_threads.id
            GROUP BY chat_threads.user_id
          ) message_counts ON message_counts.user_id = app_users.id
          LEFT JOIN (
            SELECT user_id, COUNT(*)::int AS active_sessions
            FROM app_sessions
            WHERE expires_at > $1
            GROUP BY user_id
          ) session_counts ON session_counts.user_id = app_users.id
          ORDER BY app_users.created_at DESC
          LIMIT 50
        `,
        [now]
      )
    ]);

    return {
      stats: {
        users: usersCount,
        activeUsers: activeUsersCount,
        activeSessions: sessionsCount,
        chatThreads: threadsCount,
        chatMessages: messagesCount
      },
      users: users.rows.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: toBoolean(user.is_active),
        createdAt: toNumber(user.created_at),
        threadCount: toNumber(user.thread_count),
        messageCount: toNumber(user.message_count),
        activeSessions: toNumber(user.active_sessions),
        isCurrentAdmin: user.id === currentAdminId
      }))
    };
  } catch {
    return emptySnapshot;
  }
}

async function getCount(sql: string, params: unknown[] = []) {
  const result = await query<CountRow>(sql, params);
  return toNumber(result.rows[0]?.count);
}

function toAdminSlot(slot: AionRouteSlot) {
  return {
    id: slot.id,
    label: slot.label,
    provider: slot.provider,
    model: slot.model,
    enabled: slot.enabled
  };
}

function toNumber(value: string | number | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: boolean | string | number | null | undefined) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function hasAnyBudgetEnv() {
  return [
    "AION_PROVIDER_BUDGET_USD",
    "OPENAI_BUDGET_USD",
    "ANTHROPIC_BUDGET_USD",
    "GEMINI_BUDGET_USD",
    "DEEPSEEK_BUDGET_USD",
    "GROK_BUDGET_USD"
  ].some((key) => Boolean(readEnv(key)));
}

function readEnv(key: string) {
  return process.env[key]?.trim() ?? "";
}
