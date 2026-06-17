import { NextResponse } from "next/server";
import { settlePayment } from "@/services/payments";
import { verifyRazorpayWebhook } from "@/services/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-to-server confirmation. Configure this URL in the Razorpay dashboard
 * with the `payment.captured` event and set RAZORPAY_WEBHOOK_SECRET.
 * Crediting is idempotent, so this is safe alongside the client verify call.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhook(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const entity = event.payload?.payment?.entity;

  if (event.event === "payment.captured" && entity?.order_id && entity.id) {
    try {
      await settlePayment(entity.order_id, entity.id);
    } catch (error) {
      console.error("Razorpay webhook settle failed", error);
      // Still acknowledge so Razorpay does not hammer retries; the client verify
      // call (or a later retry) will reconcile.
    }
  }

  return NextResponse.json({ ok: true });
}
