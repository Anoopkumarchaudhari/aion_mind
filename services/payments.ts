import { randomUUID } from "crypto";
import { query } from "@/services/db";
import { grantCredits } from "@/services/credits";
import { getResolvedBillingCatalog } from "@/services/adminSettings";
import {
  RazorpayError,
  createRazorpayOrder,
  getRazorpayPublicKeyId,
  verifyRazorpaySignature
} from "@/services/razorpay";

export type PurchaseKind = "plan" | "topup";

export type ResolvedPurchase = {
  kind: PurchaseKind;
  itemId: string;
  label: string;
  amountInr: number;
  credits: number;
  planId: string | null;
};

export type PaymentOrder = {
  orderId: string;
  amount: number; // paise (what the checkout widget expects)
  currency: "INR";
  keyId: string;
  kind: PurchaseKind;
  itemId: string;
  label: string;
  credits: number;
  planId: string | null;
};

export type PaymentResult = {
  ok: true;
  kind: PurchaseKind;
  itemId: string;
  label: string;
  credits: number;
  planId: string | null;
  amountInr: number;
  alreadyProcessed: boolean;
};

type PaymentRow = {
  user_id: string;
  kind: string;
  item_id: string;
  item_label: string;
  amount_inr: number;
  credits: number;
  plan_id: string | null;
  status: string;
};

/** Look up an item's real price/credits from the admin-resolved catalog (never trust the client). */
export async function resolvePurchase(kind: unknown, itemId: unknown): Promise<ResolvedPurchase> {
  if (kind !== "plan" && kind !== "topup") {
    throw new RazorpayError("Unknown purchase type.", 400);
  }

  if (typeof itemId !== "string" || !itemId) {
    throw new RazorpayError("Missing item id.", 400);
  }

  const catalog = await getResolvedBillingCatalog();

  if (kind === "plan") {
    const plan = catalog.plans.find((item) => item.id === itemId);

    if (!plan) {
      throw new RazorpayError("Unknown plan.", 400);
    }

    return {
      kind,
      itemId: plan.id,
      label: `${plan.name} plan`,
      amountInr: plan.priceInr,
      credits: plan.monthlyCredits,
      planId: plan.id
    };
  }

  const pack = catalog.topUps.find((item) => item.id === itemId);

  if (!pack) {
    throw new RazorpayError("Unknown credit pack.", 400);
  }

  return {
    kind,
    itemId: pack.id,
    label: `${pack.name} credit pack`,
    amountInr: pack.priceInr,
    credits: pack.credits,
    planId: null
  };
}

/** Create a Razorpay order for a purchase and store a pending payment row. */
export async function createPaymentOrder(
  userId: string,
  kind: unknown,
  itemId: unknown
): Promise<PaymentOrder> {
  const purchase = await resolvePurchase(kind, itemId);

  if (purchase.amountInr <= 0) {
    throw new RazorpayError("This item is free and does not require payment.", 400);
  }

  const order = await createRazorpayOrder({
    amountInr: purchase.amountInr,
    receipt: `aria_${purchase.kind}_${randomUUID().slice(0, 12)}`,
    notes: { userId, kind: purchase.kind, itemId: purchase.itemId }
  });

  const now = Date.now();

  await query(
    `INSERT INTO payments
       (id, user_id, provider, kind, item_id, item_label, amount_inr, credits, plan_id, status, created_at, updated_at)
     VALUES ($1, $2, 'razorpay', $3, $4, $5, $6, $7, $8, 'created', $9, $9)
     ON CONFLICT (id) DO NOTHING`,
    [
      order.id,
      userId,
      purchase.kind,
      purchase.itemId,
      purchase.label,
      purchase.amountInr,
      purchase.credits,
      purchase.planId,
      now
    ]
  );

  return {
    orderId: order.id,
    amount: order.amount,
    currency: "INR",
    keyId: getRazorpayPublicKeyId(),
    kind: purchase.kind,
    itemId: purchase.itemId,
    label: purchase.label,
    credits: purchase.credits,
    planId: purchase.planId
  };
}

/** Verify the checkout signature for the signed-in user, then credit the account. */
export async function confirmCheckout(
  userId: string,
  orderId: string,
  paymentId: string,
  signature: string
): Promise<PaymentResult> {
  if (!verifyRazorpaySignature({ orderId, paymentId, signature })) {
    throw new RazorpayError("Payment signature verification failed.", 400);
  }

  const row = await loadPayment(orderId);

  if (!row || row.user_id !== userId) {
    throw new RazorpayError("Payment not found for this account.", 404);
  }

  return settlePayment(orderId, paymentId);
}

/**
 * Mark a payment paid and grant credits. Idempotent: a payment that is already
 * "paid" returns its result without crediting again.
 */
export async function settlePayment(orderId: string, paymentId: string): Promise<PaymentResult> {
  const row = await loadPayment(orderId);

  if (!row) {
    throw new RazorpayError("Payment not found.", 404);
  }

  const result: PaymentResult = {
    ok: true,
    kind: row.kind === "plan" ? "plan" : "topup",
    itemId: row.item_id,
    label: row.item_label,
    credits: row.credits,
    planId: row.plan_id,
    amountInr: row.amount_inr,
    alreadyProcessed: row.status === "paid"
  };

  if (row.status === "paid") {
    return result;
  }

  const now = Date.now();

  // Flip to paid only if still pending — guards against a concurrent double-credit.
  const updated = await query(
    `UPDATE payments SET status = 'paid', payment_id = $2, updated_at = $3
     WHERE id = $1 AND status <> 'paid'`,
    [orderId, paymentId, now]
  );

  if (updated.rowCount === 0) {
    return { ...result, alreadyProcessed: true };
  }

  // Credit the account and record the grant in the ledger (server-authoritative).
  if (result.kind === "plan" && result.planId) {
    await grantCredits(row.user_id, {
      kind: "plan",
      label: result.label,
      credits: result.credits,
      planId: result.planId,
      amountInr: result.amountInr
    });
  } else {
    await grantCredits(row.user_id, {
      kind: "topup",
      label: result.label,
      credits: result.credits,
      amountInr: result.amountInr
    });
  }

  return result;
}

async function loadPayment(orderId: string): Promise<PaymentRow | null> {
  if (!orderId) {
    return null;
  }

  const result = await query<PaymentRow>(
    `SELECT user_id, kind, item_id, item_label, amount_inr, credits, plan_id, status
     FROM payments WHERE id = $1`,
    [orderId]
  );

  return result.rows[0] ?? null;
}
