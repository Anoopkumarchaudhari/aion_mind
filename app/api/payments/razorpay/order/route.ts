import { NextResponse } from "next/server";
import { AuthError, requireCurrentUser } from "@/services/auth";
import { createPaymentOrder } from "@/services/payments";
import { RazorpayError } from "@/services/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  kind?: unknown;
  itemId?: unknown;
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

    const order = await createPaymentOrder(user.id, body.kind, body.itemId);
    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof AuthError || error instanceof RazorpayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Razorpay order failed", error);
    return NextResponse.json({ error: "Could not start the payment." }, { status: 500 });
  }
}
