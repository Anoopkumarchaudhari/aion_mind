export type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  notes?: Record<string, string>;
  theme?: { color?: string; backdrop_color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, callback: (response: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);

    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => {
        scriptPromise = null;
        resolve(false);
      });
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

/** Loads the hosted checkout (if needed) and opens it. Returns false if the script can't load. */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
  onFailure?: (reason: string) => void
): Promise<boolean> {
  const loaded = await loadRazorpayScript();

  if (!loaded || !window.Razorpay) {
    return false;
  }

  const instance = new window.Razorpay(options);

  instance.on("payment.failed", (response) => {
    const description =
      (response as { error?: { description?: string } })?.error?.description ?? "Payment failed.";
    onFailure?.(description);
  });

  instance.open();
  return true;
}
