import { randomUUID } from "crypto";
import { query } from "@/services/db";
import { getResolvedBillingCatalog } from "@/services/adminSettings";

export type CreditLedgerKind = "signup" | "plan" | "topup" | "usage" | "renewal" | "adjust";

export type CreditLedgerEntry = {
  id: string;
  kind: CreditLedgerKind;
  featureId: string | null;
  label: string;
  credits: number; // signed delta
  balanceAfter: number;
  amountInr: number | null;
  status: string;
  createdAt: number;
};

export type CreditAccount = {
  planId: string;
  credits: number;
  ledger: CreditLedgerEntry[];
};

export type SpendResult = { ok: boolean; balance: number };

// Sanity bounds so a single charge can never be absurd, even if a request is malformed.
const MAX_SINGLE_CHARGE = 100_000;
const LEDGER_PAGE_SIZE = 60;

type UserCreditRow = { plan_id: string; credits: number; credits_initialized: boolean };

/**
 * One-time, race-safe reconciliation: set the balance equal to the sum of the
 * user's ledger entries. This removes "phantom" credits that were written
 * directly to app_users.credits before the ledger existed. It runs in a single
 * row-locked UPDATE (guarded by the flag) so a concurrent spend can't be lost.
 */
async function ensureLedgerReconciled(userId: string): Promise<void> {
  await query(
    `UPDATE app_users
       SET credits = COALESCE((SELECT SUM(credits) FROM credit_ledger WHERE user_id = app_users.id), 0),
           ledger_reconciled = TRUE
     WHERE id = $1 AND ledger_reconciled = FALSE`,
    [userId]
  );
}

type LedgerRow = {
  id: string;
  kind: string;
  feature_id: string | null;
  label: string;
  credits: number;
  balance_after: number;
  amount_inr: number | null;
  status: string;
  created_at: string | number;
};

async function loadUserCredits(userId: string): Promise<UserCreditRow | null> {
  const result = await query<UserCreditRow>(
    "SELECT plan_id, credits, credits_initialized FROM app_users WHERE id = $1",
    [userId]
  );

  return result.rows[0] ?? null;
}

/**
 * Grant the free-plan monthly credits exactly once, the first time a user is
 * seen. The `credits_initialized` flag is flipped atomically so a re-login or a
 * concurrent request can never re-grant or reset the balance.
 */
export async function ensureInitialCredits(userId: string): Promise<void> {
  const row = await loadUserCredits(userId);

  if (!row || row.credits_initialized) {
    return;
  }

  const claimed = await query(
    "UPDATE app_users SET credits_initialized = TRUE WHERE id = $1 AND credits_initialized = FALSE RETURNING id",
    [userId]
  );

  if (claimed.rowCount === 0) {
    return; // another request already initialized this account
  }

  // Only seed the free allotment for a genuinely empty wallet. Accounts that
  // already hold a balance (e.g. created before this feature, or topped up)
  // keep exactly what they have — no surprise bonus.
  if (row.credits > 0) {
    return;
  }

  const catalog = await getResolvedBillingCatalog();
  const freePlan = catalog.plans.find((plan) => plan.id === "free");
  const grant = Math.max(0, Math.floor(freePlan?.monthlyCredits ?? 0));

  if (grant > 0) {
    await grantCredits(userId, { kind: "signup", label: "Welcome credits", credits: grant });
  }
}

export async function getCreditAccount(userId: string): Promise<CreditAccount> {
  await ensureInitialCredits(userId);
  await ensureLedgerReconciled(userId);

  const row = await loadUserCredits(userId);
  const ledger = await query<LedgerRow>(
    `SELECT id, kind, feature_id, label, credits, balance_after, amount_inr, status, created_at
     FROM credit_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, LEDGER_PAGE_SIZE]
  );

  return {
    planId: row?.plan_id ?? "free",
    credits: Math.max(0, row?.credits ?? 0),
    ledger: ledger.rows.map(mapLedgerRow)
  };
}

export async function grantCredits(
  userId: string,
  input: {
    kind: CreditLedgerKind;
    label: string;
    credits: number;
    planId?: string | null;
    amountInr?: number | null;
    featureId?: string | null;
    status?: string;
  }
): Promise<number> {
  const amount = Math.max(0, Math.floor(input.credits));

  const result =
    input.planId != null
      ? await query<{ credits: number }>(
          "UPDATE app_users SET plan_id = $2, credits = credits + $3 WHERE id = $1 RETURNING credits",
          [userId, input.planId, amount]
        )
      : await query<{ credits: number }>(
          "UPDATE app_users SET credits = credits + $2 WHERE id = $1 RETURNING credits",
          [userId, amount]
        );

  const balanceAfter = Math.max(0, result.rows[0]?.credits ?? 0);

  await insertLedger(userId, {
    kind: input.kind,
    featureId: input.featureId ?? null,
    label: input.label,
    credits: amount,
    balanceAfter,
    amountInr: input.amountInr ?? null,
    status: input.status ?? (input.amountInr ? "paid" : "recorded")
  });

  return balanceAfter;
}

/**
 * Deduct credits atomically. The conditional UPDATE relies on Postgres row
 * locking so two concurrent spends can never push the balance below zero.
 */
export async function spendCredits(
  userId: string,
  input: { featureId?: string | null; label: string; credits: number }
): Promise<SpendResult> {
  const amount = Math.min(MAX_SINGLE_CHARGE, Math.max(1, Math.floor(input.credits)));

  await ensureInitialCredits(userId);
  await ensureLedgerReconciled(userId);

  const result = await query<{ credits: number }>(
    "UPDATE app_users SET credits = credits - $2 WHERE id = $1 AND credits >= $2 RETURNING credits",
    [userId, amount]
  );

  if (result.rowCount === 0) {
    const row = await loadUserCredits(userId);
    return { ok: false, balance: Math.max(0, row?.credits ?? 0) };
  }

  const balanceAfter = Math.max(0, result.rows[0].credits);

  await insertLedger(userId, {
    kind: "usage",
    featureId: input.featureId ?? null,
    label: input.label,
    credits: -amount,
    balanceAfter,
    amountInr: null,
    status: "recorded"
  });

  return { ok: true, balance: balanceAfter };
}

/** Switch the user to the free plan (a downgrade) without changing the balance. */
export async function setFreePlan(userId: string): Promise<CreditAccount> {
  await query("UPDATE app_users SET plan_id = 'free' WHERE id = $1", [userId]);
  return getCreditAccount(userId);
}

async function insertLedger(
  userId: string,
  entry: {
    kind: CreditLedgerKind;
    featureId: string | null;
    label: string;
    credits: number;
    balanceAfter: number;
    amountInr: number | null;
    status: string;
  }
): Promise<void> {
  await query(
    `INSERT INTO credit_ledger
       (id, user_id, kind, feature_id, label, credits, balance_after, amount_inr, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      randomUUID(),
      userId,
      entry.kind,
      entry.featureId,
      entry.label,
      entry.credits,
      entry.balanceAfter,
      entry.amountInr,
      entry.status,
      Date.now()
    ]
  );
}

function mapLedgerRow(row: LedgerRow): CreditLedgerEntry {
  return {
    id: row.id,
    kind: row.kind as CreditLedgerKind,
    featureId: row.feature_id,
    label: row.label,
    credits: Number(row.credits),
    balanceAfter: Number(row.balance_after),
    amountInr: row.amount_inr == null ? null : Number(row.amount_inr),
    status: row.status,
    createdAt: Number(row.created_at)
  };
}
