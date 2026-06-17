import { createHmac, timingSafeEqual } from "crypto";

/**
 * Razorpay integration via the public REST API + HMAC signature checks.
 * No SDK dependency. All secret material is read from env, never hard-coded.
 *
 * The only two values Razorpay gives you when creating an API key:
 *   RAZORPAY_KEY_ID         - key id (sent to the browser via the order response)
 *   RAZORPAY_KEY_SECRET     - key secret (server only; never exposed)
 *
 * Optional, only if you also configure a dashboard webhook:
 *   RAZORPAY_WEBHOOK_SECRET - webhook signing secret
 */

const RAZORPAY_API = "https://api.razorpay.com/v1";

export class RazorpayError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "RazorpayError";
    this.status = status;
  }
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
};

export function getRazorpayKeyId() {
  return readEnv("RAZORPAY_KEY_ID");
}

/**
 * Key id handed to the browser checkout. It's the publishable half of the pair,
 * so it's safe to send in the order API response (no NEXT_PUBLIC_ var needed).
 */
export function getRazorpayPublicKeyId() {
  return readEnv("RAZORPAY_KEY_ID");
}

export function isRazorpayConfigured() {
  return Boolean(readEnv("RAZORPAY_KEY_ID") && readEnv("RAZORPAY_KEY_SECRET"));
}

function assertConfigured() {
  if (!isRazorpayConfigured()) {
    throw new RazorpayError(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.",
      503
    );
  }
}

function authHeader() {
  const token = Buffer.from(`${readEnv("RAZORPAY_KEY_ID")}:${readEnv("RAZORPAY_KEY_SECRET")}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Create an order. `amountInr` is in rupees; Razorpay expects the smallest unit
 * (paise), so it is multiplied by 100 here.
 */
export async function createRazorpayOrder({
  amountInr,
  receipt,
  notes
}: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  assertConfigured();

  const amountPaise = Math.round(amountInr * 100);

  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw new RazorpayError("Invalid payment amount.", 400);
  }

  let response: Response;

  try {
    response = await fetch(`${RAZORPAY_API}/orders`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: receipt.slice(0, 40),
        payment_capture: 1,
        notes
      })
    });
  } catch (error) {
    throw new RazorpayError(
      `Could not reach Razorpay: ${error instanceof Error ? error.message : "network error"}`
    );
  }

  const data = (await response.json().catch(() => null)) as
    | (RazorpayOrder & { error?: { description?: string } })
    | null;

  if (!response.ok || !data?.id) {
    const detail = data?.error?.description || `Razorpay returned ${response.status}`;
    throw new RazorpayError(`Could not create payment order: ${detail}`);
  }

  return {
    id: data.id,
    amount: data.amount,
    currency: data.currency,
    receipt: data.receipt,
    status: data.status
  };
}

/**
 * Verify the checkout callback signature:
 * HMAC_SHA256(`${orderId}|${paymentId}`, keySecret) === razorpay_signature.
 */
export function verifyRazorpaySignature({
  orderId,
  paymentId,
  signature
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = readEnv("RAZORPAY_KEY_SECRET");

  if (!secret || !orderId || !paymentId || !signature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Verify a Razorpay webhook payload using the webhook secret. */
export function verifyRazorpayWebhook(rawBody: string, signature: string | null): boolean {
  const secret = readEnv("RAZORPAY_WEBHOOK_SECRET");

  if (!secret || !signature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

function safeEqualHex(expectedHex: string, providedHex: string) {
  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");

  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function readEnv(key: string) {
  return process.env[key]?.trim() ?? "";
}
