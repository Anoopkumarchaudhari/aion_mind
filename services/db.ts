import { Pool, type PoolConfig, type QueryResultRow } from "pg";

const globalKey = "__aionMindPgPool";
const schemaKey = "__aionMindPgSchemaReady_v3";
const splitConfigPrefixes = ["AION_PG", "JBTALLY_PG"] as const;
const requiredSplitConfigKeys = ["HOST", "DATABASE", "USER", "PASSWORD"] as const;

type PoolEntry = {
  pool: Pool;
  signature: string;
};

type GlobalWithPool = typeof globalThis & {
  [globalKey]?: PoolEntry;
  [schemaKey]?: Promise<void>;
};

type ResolvedDatabaseConfig =
  | {
      configured: true;
      poolConfig: PoolConfig;
      signature: string;
    }
  | {
      configured: false;
      message: string;
    };

const globalStore = globalThis as GlobalWithPool;

export function isDatabaseConfigured() {
  return resolveDatabaseConfig().configured;
}

export function getDatabaseConfigIssue() {
  const resolved = resolveDatabaseConfig();

  return resolved.configured ? null : resolved.message;
}

export function getPool() {
  const resolved = resolveDatabaseConfig();

  if (!resolved.configured) {
    throw new Error(resolved.message);
  }

  if (!globalStore[globalKey] || globalStore[globalKey].signature !== resolved.signature) {
    const previousPool = globalStore[globalKey]?.pool;

    globalStore[globalKey] = {
      pool: new Pool(resolved.poolConfig),
      signature: resolved.signature
    };
    delete globalStore[schemaKey];

    void previousPool?.end().catch(() => undefined);
  }

  return globalStore[globalKey].pool;
}

export async function ensureDatabaseSchema() {
  if (!globalStore[schemaKey]) {
    globalStore[schemaKey] = createSchema().catch((error) => {
      delete globalStore[schemaKey];
      throw error;
    });
  }

  return globalStore[schemaKey];
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  await ensureDatabaseSchema();
  return getPool().query<T>(text, params);
}

async function createSchema() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at BIGINT NOT NULL
    );

    ALTER TABLE app_users
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

    CREATE TABLE IF NOT EXISTS app_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_threads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      pinned BOOLEAN NOT NULL DEFAULT FALSE,
      notebook TEXT,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT,
      attachments JSONB,
      attachment_context TEXT,
      diagnostics JSONB,
      created_at BIGINT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON app_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON app_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_chat_threads_user_updated ON chat_threads(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_position ON chat_messages(thread_id, position);
  `);
}

function resolveDatabaseConfig(): ResolvedDatabaseConfig {
  const splitConfigs = splitConfigPrefixes.map(resolveSplitDatabaseConfig).filter(Boolean);
  const completeSplitConfig = splitConfigs.find((config) => config?.configured);

  if (completeSplitConfig) {
    return completeSplitConfig;
  }

  const databaseUrl = readEnv("DATABASE_URL");

  if (databaseUrl) {
    return resolveDatabaseUrlConfig(databaseUrl);
  }

  const partialSplitConfig = splitConfigs.find((config) => config && !config.configured);

  if (partialSplitConfig) {
    return partialSplitConfig;
  }

  return {
    configured: false,
    message: "PostgreSQL is not configured. Add DATABASE_URL or AION_PG_* values to .env, then restart the dev server."
  };
}

function resolveDatabaseUrlConfig(databaseUrl: string): ResolvedDatabaseConfig {
  if (databaseUrl.includes("://USER:") || databaseUrl.includes("@HOST:")) {
    return {
      configured: false,
      message: "DATABASE_URL still contains USER or HOST placeholders. Replace them with your real PostgreSQL username and host."
    };
  }

  try {
    const parsed = new URL(databaseUrl);

    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      return {
        configured: false,
        message: "DATABASE_URL must start with postgresql:// or postgres://."
      };
    }

    if (!parsed.username || !parsed.hostname || !parsed.pathname.replace("/", "")) {
      return {
        configured: false,
        message: "DATABASE_URL must include username, host, and database name."
      };
    }
  } catch {
    return {
      configured: false,
      message: "DATABASE_URL is not a valid PostgreSQL connection URL. Encode special password characters like #, &, ^, @, and *."
    };
  }

  return {
    configured: true,
    poolConfig: {
      connectionString: databaseUrl,
      ssl: readBooleanEnv("DATABASE_SSL") ? { rejectUnauthorized: false } : undefined
    },
    signature: `DATABASE_URL:${databaseUrl}:${readEnv("DATABASE_SSL")}`
  };
}

function resolveSplitDatabaseConfig(
  prefix: (typeof splitConfigPrefixes)[number]
): ResolvedDatabaseConfig | null {
  const values = requiredSplitConfigKeys.map((key) => readEnv(`${prefix}_${key}`));
  const hasAnyValue = values.some(Boolean) || readEnv(`${prefix}_PORT`) || readEnv(`${prefix}_SSL`);

  if (!hasAnyValue) {
    return null;
  }

  const missingKeys = requiredSplitConfigKeys.filter((key) => !readEnv(`${prefix}_${key}`));

  if (missingKeys.length) {
    return {
      configured: false,
      message: `${prefix}_* is missing ${missingKeys.map((key) => `${prefix}_${key}`).join(", ")}.`
    };
  }

  const port = Number(readEnv(`${prefix}_PORT`) || "5432");

  if (!Number.isInteger(port) || port <= 0) {
    return {
      configured: false,
      message: `${prefix}_PORT must be a valid PostgreSQL port number.`
    };
  }

  const ssl = readBooleanEnv(`${prefix}_SSL`);
  const host = readEnv(`${prefix}_HOST`);
  const database = readEnv(`${prefix}_DATABASE`);
  const user = readEnv(`${prefix}_USER`);
  const password = readEnv(`${prefix}_PASSWORD`);

  return {
    configured: true,
    poolConfig: {
      host,
      port,
      database,
      user,
      password,
      ssl: ssl ? { rejectUnauthorized: false } : undefined
    },
    signature: `${prefix}:${host}:${port}:${database}:${user}:${password}:${ssl}`
  };
}

function readEnv(key: string) {
  return process.env[key]?.trim() ?? "";
}

function readBooleanEnv(key: string) {
  return ["1", "true", "yes", "require"].includes(readEnv(key).toLowerCase());
}
