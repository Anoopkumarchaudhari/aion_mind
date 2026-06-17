import { NextResponse } from "next/server";
import { AuthError, requireCurrentUser } from "@/services/auth";
import { confirmCheckout } from "@/services/payments";
import { RazorpayError } from "@/services/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
    const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
    const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";

    const result = await confirmCheckout(user.id, orderId, paymentId, signature);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError || error instanceof RazorpayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Razorpay verification failed", error);
    return NextResponse.json({ error: "Could not verify the payment." }, { status: 500 });
  }
}
