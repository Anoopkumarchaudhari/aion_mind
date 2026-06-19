"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { openRazorpayCheckout } from "@/lib/razorpayCheckout";
import {
  Activity,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  IndianRupee,
  Plus,
  ShieldCheck,
  Wallet,
  Zap
} from "lucide-react";
import { downloadInvoice } from "@/lib/invoice";
import {
  barFillVariants,
  hoverLift,
  scrollContainerVariants,
  scrollItemVariants,
  scrollRevealVariants,
  scrollRevealViewport
} from "@/lib/motion";
import {
  BILLING_PLANS,
  getBillingPlan,
  useBillingStore,
  type BillingFeatureId,
  type BillingPlanId
} from "@/store/useBillingStore";
import type { FeatureCreditRate, ResolvedBillingCatalog } from "@/services/billingCatalog";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const POPULAR_PLAN_ID = "pro";

const PLAN_FEATURES: Record<string, string[]> = {
  free: ["Every Aria mode", "Pay-as-you-go top-ups", "Community support"],
  starter: ["Every Aria mode", "Top-ups anytime", "Email support"],
  plus: ["Everything in Starter", "Priority model routing", "Email support"],
  pro: ["Everything in Plus", "Highest throughput", "Priority support"],
  power: ["Everything in Pro", "Maximum monthly credits", "Priority support"]
};

function getPlanFeatures(planId: string) {
  return PLAN_FEATURES[planId] ?? ["Every Aria mode", "Top-ups anytime", "Email support"];
}

export function BillingPageContent({ catalog }: { catalog: ResolvedBillingCatalog }) {
  const billing = useBillingStore();
  // Resolve the active plan from the admin-edited catalog so credits/price reflect edits.
  const currentPlan = catalog.plans.find((plan) => plan.id === billing.planId) ?? getBillingPlan(billing.planId);
  // Server-authoritative single balance — survives logout/login, never shared across accounts.
  const availableCredits = billing.credits;
  const monthlyAllotment = currentPlan.monthlyCredits;
  const monthlyRemaining = Math.min(availableCredits, monthlyAllotment);
  const usedPercent = Math.min(100, Math.round((availableCredits / Math.max(1, monthlyAllotment)) * 100));
  const usageSummary = getUsageSummary(billing.usage, catalog.featureRates);
  // The Free plan has no billing/renewal — only paid plans show a renewal date.
  const isFreePlan = currentPlan.priceInr === 0;
  const nextRenewalDate = isFreePlan ? "Free forever" : getNextRenewalDate();
  // Billing shows only successful payments (failed/abandoned attempts are hidden here).
  const paidPayments = billing.payments.filter((payment) => payment.status === "paid");

  useEffect(() => {
    void useBillingStore.getState().loadAccount();
  }, []);

  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [payKind, setPayKind] = useState<"all" | "plan" | "topup">("all");

  const filteredPayments = paidPayments.filter((payment) => payKind === "all" || payment.kind === payKind);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { name?: string; email?: string } } | null) => {
        if (data?.user?.name) {
          setAccountName(data.user.name);
        }
        if (data?.user?.email) {
          setAccountEmail(data.user.email);
        }
      })
      .catch(() => undefined);
  }, []);

  const purchase = useCallback(
    async (
      kind: "plan" | "topup",
      itemId: string,
      label: string,
      amountInr: number,
      planId: string | null,
      themeColor: string
    ) => {
      // Free items need no payment — apply immediately.
      if (amountInr <= 0) {
        if (kind === "plan" && planId) {
          billing.selectPlan(planId as BillingPlanId);
          toast.success(`${label} activated.`);
        }
        return;
      }

      if (pendingItem) {
        return;
      }

      setPendingItem(itemId);

      try {
        const orderResponse = await fetch("/api/payments/razorpay/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, itemId })
        });
        const orderData = (await orderResponse.json()) as {
          error?: string;
          orderId?: string;
          amount?: number;
          currency?: string;
          keyId?: string;
        };

        if (!orderResponse.ok || !orderData.orderId || !orderData.keyId) {
          throw new Error(orderData.error || "Could not start the payment.");
        }

        const opened = await openRazorpayCheckout(
          {
            key: orderData.keyId,
            amount: orderData.amount ?? amountInr * 100,
            currency: orderData.currency ?? "INR",
            name: "AriamindX",
            description: label,
            order_id: orderData.orderId,
            prefill: { name: accountName, email: accountEmail },
            theme: {
              color: themeColor,
              // Fully transparent backdrop — the app page stays completely
              // visible behind the checkout, no dim.
              backdrop_color: "rgba(0, 0, 0, 0)"
            },
            handler: async (response) => {
              try {
                const verifyResponse = await fetch("/api/payments/razorpay/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(response)
                });
                const verifyData = (await verifyResponse.json()) as {
                  ok?: boolean;
                  error?: string;
                  kind?: "plan" | "topup";
                  itemId?: string;
                  planId?: string | null;
                  label?: string;
                  credits?: number;
                };

                if (!verifyResponse.ok || !verifyData.ok) {
                  throw new Error(verifyData.error || "Payment verification failed.");
                }

                if (verifyData.kind === "plan" && verifyData.planId) {
                  billing.selectPlan(verifyData.planId as BillingPlanId);
                } else if (verifyData.itemId) {
                  billing.buyTopUp(verifyData.itemId);
                }

                toast.success(
                  `${verifyData.label ?? label} activated — ${(verifyData.credits ?? 0).toLocaleString("en-IN")} credits added.`
                );
              } catch (verifyError) {
                toast.error(
                  verifyError instanceof Error ? verifyError.message : "Payment verification failed."
                );
              } finally {
                setPendingItem(null);
              }
            },
            modal: { ondismiss: () => setPendingItem(null) }
          },
          (reason) => {
            toast.error(reason);
            setPendingItem(null);
          }
        );

        if (!opened) {
          toast.error("Could not open the payment window. Check your connection and try again.");
          setPendingItem(null);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not start the payment.");
        setPendingItem(null);
      }
    },
    [accountEmail, accountName, billing, pendingItem]
  );

  useEffect(() => {
    const planId = new URLSearchParams(window.location.search).get("plan");

    if (isBillingPlanId(planId)) {
      const plan = catalog.plans.find((item) => item.id === planId);

      if (plan && plan.priceInr === 0 && planId !== useBillingStore.getState().planId) {
        useBillingStore.getState().selectPlan(planId);
      }

      window.history.replaceState(null, "", "/settings?tab=billing");
    }
  }, [catalog.plans]);

  return (
    <section className="route-content billing-route">
        <motion.div
          className="page-toolbar billing-toolbar"
          variants={scrollRevealVariants}
          initial="hidden"
          animate="show"
        >
          <div>
            <p className="eyebrow">Credit wallet</p>
            <h2>Billing</h2>
          </div>
          <div className="billing-toolbar-actions">
            <span className="billing-renewal-pill">{isFreePlan ? "Free forever" : `Renews ${nextRenewalDate}`}</span>
          </div>
        </motion.div>

        <motion.section
          id="billing-overview"
          className="billing-overview"
          aria-label="Credit wallet overview"
          variants={scrollContainerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div className="billing-overview-main" variants={scrollItemVariants}>
            <span className="billing-icon">
              <Wallet size={22} />
            </span>
            <div>
              <p className="eyebrow">Available balance</p>
              <strong>{availableCredits.toLocaleString("en-IN")}</strong>
              <span>credits</span>
            </div>
          </motion.div>
          <motion.div className="billing-meter-block" variants={scrollItemVariants}>
            <div className="billing-meter-copy">
              <span>{currentPlan.name} monthly credits</span>
              <strong>{monthlyRemaining.toLocaleString("en-IN")} left</strong>
            </div>
            <div className="billing-credit-meter" aria-label={`${usedPercent}% of monthly credits used`}>
              <motion.span
                style={{ width: `${usedPercent}%` }}
                variants={barFillVariants}
              />
            </div>
          </motion.div>
          <motion.div className="billing-overview-stat" variants={scrollItemVariants}>
            <span>Plan allotment</span>
            <strong>{monthlyAllotment.toLocaleString("en-IN")}</strong>
          </motion.div>
          <motion.div className="billing-overview-stat" variants={scrollItemVariants}>
            <span>Target margin</span>
            <strong>2x</strong>
          </motion.div>
        </motion.section>

        <motion.section
          id="billing-plans"
          className="billing-section"
          aria-labelledby="billing-plans-heading"
          variants={scrollRevealVariants}
          initial="hidden"
          whileInView="show"
          viewport={scrollRevealViewport}
        >
          <div className="billing-section-heading">
            <div>
              <p className="eyebrow">Plans</p>
              <h3 id="billing-plans-heading">Monthly credits</h3>
            </div>
            <span>Every plan unlocks every Aria feature.</span>
          </div>

          <motion.div
            className="billing-plan-grid"
            variants={scrollContainerVariants}
            initial="hidden"
            whileInView="show"
            viewport={scrollRevealViewport}
          >
            {catalog.plans.map((plan) => {
              const isActive = plan.id === billing.planId;
              const isPopular = plan.id === POPULAR_PLAN_ID;

              return (
                <motion.article
                  className={`billing-plan-card ${isActive ? "is-active" : ""} ${isPopular ? "is-popular" : ""}`}
                  key={plan.id}
                  style={{ "--plan-color": plan.accent } as CSSProperties}
                  variants={scrollItemVariants}
                  whileHover={hoverLift}
                >
                  <span className="billing-plan-accent" aria-hidden="true" />
                  {isPopular ? <span className="billing-plan-badge">Most popular</span> : null}

                  <div className="billing-plan-topline">
                    <span>{plan.name}</span>
                    {isActive ? <CheckCircle2 size={16} /> : null}
                  </div>

                  <div className="billing-plan-price">
                    <strong>{inrFormatter.format(plan.priceInr)}</strong>
                    <span>{plan.priceInr === 0 ? "free forever" : "/ month"}</span>
                  </div>

                  <p className="billing-plan-credits">
                    <Zap size={14} aria-hidden="true" />
                    {plan.monthlyCredits.toLocaleString("en-IN")} credits / month
                  </p>

                  <ul className="billing-plan-features">
                    {getPlanFeatures(plan.id).map((feature) => (
                      <li key={feature}>
                        <Check size={13} aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    className={isActive ? "ghost-button full" : "primary-button full"}
                    type="button"
                    onClick={() =>
                      purchase("plan", plan.id, `${plan.name} plan`, plan.priceInr, plan.id, plan.accent)
                    }
                    disabled={isActive || pendingItem === plan.id}
                  >
                    {isActive
                      ? "Current plan"
                      : pendingItem === plan.id
                        ? "Processing..."
                        : plan.priceInr === 0
                          ? "Choose plan"
                          : `Pay ${inrFormatter.format(plan.priceInr)}`}
                  </button>
                </motion.article>
              );
            })}
          </motion.div>
        </motion.section>

        <motion.div
          className="billing-dashboard-grid"
          variants={scrollContainerVariants}
          initial="hidden"
          whileInView="show"
          viewport={scrollRevealViewport}
        >

          <motion.section
            id="billing-topups"
            className="billing-panel"
            aria-labelledby="topups-heading"
            variants={scrollItemVariants}
          >
            <div className="billing-panel-heading">
              <span className="billing-icon small">
                <Plus size={17} />
              </span>
              <div>
                <p className="eyebrow">Top-ups</p>
                <h3 id="topups-heading">Credit packs</h3>
              </div>
            </div>
            <div className="billing-topup-list">
              {catalog.topUps.map((pack) => (
                <motion.div className="billing-topup-row" key={pack.id} whileHover={hoverLift}>
                  <div>
                    <strong>{pack.name}</strong>
                    <span>{pack.credits.toLocaleString("en-IN")} credits</span>
                  </div>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() =>
                      purchase("topup", pack.id, `${pack.name} credit pack`, pack.priceInr, null, "#22d3ee")
                    }
                    disabled={pendingItem === pack.id}
                  >
                    {pendingItem === pack.id ? "..." : inrFormatter.format(pack.priceInr)}
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            id="billing-usage"
            className="billing-panel"
            aria-labelledby="usage-heading"
            variants={scrollItemVariants}
          >
            <div className="billing-panel-heading">
              <span className="billing-icon small">
                <Activity size={17} />
              </span>
              <div>
                <p className="eyebrow">Usage</p>
                <h3 id="usage-heading">Current cycle</h3>
              </div>
            </div>
            <div className="billing-usage-list">
              {usageSummary.length === 0 ? (
                <p className="muted-copy">No credits spent in this cycle yet.</p>
              ) : (
                usageSummary.map((item) => (
                  <motion.div className="billing-usage-row" key={item.featureId} whileHover={hoverLift}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.credits.toLocaleString("en-IN")} credits</span>
                    </div>
                    <div className="billing-usage-bar">
                      <motion.span
                        style={{ width: `${item.percent}%`, background: item.color }}
                        variants={barFillVariants}
                      />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.section>

          <motion.section
            id="billing-payment"
            className="billing-panel"
            aria-labelledby="payment-heading"
            variants={scrollItemVariants}
          >
            <div className="billing-panel-heading">
              <span className="billing-icon small">
                <CreditCard size={17} />
              </span>
              <div>
                <p className="eyebrow">Payment</p>
                <h3 id="payment-heading">Wallet controls</h3>
              </div>
            </div>
            <div className="billing-control-list">
              <label className="billing-switch-row">
                <span>
                  <strong>Auto top-up</strong>
                  <small>Refill when balance is low</small>
                </span>
                <input type="checkbox" checked={billing.autoTopUpEnabled} onChange={billing.toggleAutoTopUp} />
              </label>
              <label className="billing-switch-row">
                <span>
                  <strong>Email invoices</strong>
                  <small>Send receipts to the account email</small>
                </span>
                <input type="checkbox" checked={billing.invoiceEmailEnabled} onChange={billing.toggleInvoiceEmail} />
              </label>
              <div className="billing-payment-method">
                <ShieldCheck size={16} />
                <span>{billing.paymentMethodLabel}</span>
              </div>
            </div>
          </motion.section>
        </motion.div>

        <motion.section
          id="billing-payments"
          className="billing-section"
          aria-labelledby="payments-heading"
          variants={scrollRevealVariants}
          initial="hidden"
          whileInView="show"
          viewport={scrollRevealViewport}
        >
          <div className="billing-section-heading">
            <div>
              <p className="eyebrow">Transactions</p>
              <h3 id="payments-heading">Payments & invoices</h3>
            </div>
            <span>{paidPayments.length} successful</span>
          </div>

          {paidPayments.length > 0 ? (
            <div className="admin-detail-filters">
              <div className="admin-filter-group">
                {(["all", "plan", "topup"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`admin-filter-chip ${payKind === value ? "is-active" : ""}`}
                    onClick={() => setPayKind(value)}
                  >
                    {value === "all" ? "Any type" : value === "plan" ? "Plans" : "Top-ups"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {paidPayments.length === 0 ? (
            <p className="muted-copy">No successful payments yet. Buy a plan or top-up to see invoices here.</p>
          ) : filteredPayments.length === 0 ? (
            <p className="muted-copy">No payments match this filter.</p>
          ) : (
            <motion.div className="billing-ledger" variants={scrollContainerVariants} initial="hidden" animate="show">
              {filteredPayments.map((payment) => {
                return (
                  <motion.div className="billing-ledger-row billing-payment-row" key={payment.id} variants={scrollItemVariants}>
                    <span className="billing-icon small">
                      <IndianRupee size={16} />
                    </span>
                    <div>
                      <strong>{payment.label}</strong>
                      <span>{formatLedgerDate(payment.createdAt)}</span>
                    </div>
                    <span className="billing-status-pill is-available">Paid</span>
                    <strong>{inrFormatter.format(payment.amountInr)}</strong>
                    <button
                      className="billing-invoice-button"
                      type="button"
                      onClick={() => downloadInvoice(payment, { name: accountName, email: accountEmail })}
                      title="Download PDF invoice"
                    >
                      <Download size={14} />
                      Invoice
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </motion.section>

        <motion.section
          id="billing-ledger"
          className="billing-section"
          aria-labelledby="ledger-heading"
          variants={scrollRevealVariants}
          initial="hidden"
          whileInView="show"
          viewport={scrollRevealViewport}
        >
          <div className="billing-section-heading">
            <div>
              <p className="eyebrow">Records</p>
              <h3 id="ledger-heading">Invoices and credit activity</h3>
            </div>
          </div>
          <motion.div
            className="billing-ledger"
            variants={scrollContainerVariants}
            initial="hidden"
            whileInView="show"
            viewport={scrollRevealViewport}
          >
            {billing.ledger.map((item) => (
              <motion.div className="billing-ledger-row" key={item.id} variants={scrollItemVariants}>
                <span className="billing-icon small">
                  <IndianRupee size={16} />
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <span>{formatLedgerDate(item.createdAt)} - {item.status}</span>
                </div>
                <em className={item.credits < 0 ? "is-negative" : ""}>
                  {item.credits > 0 ? "+" : ""}
                  {item.credits.toLocaleString("en-IN")} credits
                </em>
                <strong>{item.amountInr !== undefined ? inrFormatter.format(item.amountInr) : "-"}</strong>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
    </section>
  );
}

function getUsageSummary(
  usage: Array<{ featureId: BillingFeatureId; credits: number }>,
  featureRates: FeatureCreditRate[]
) {
  const total = usage.reduce((sum, item) => sum + item.credits, 0);

  return featureRates.map((rate) => {
    const credits = usage
      .filter((item) => item.featureId === rate.id)
      .reduce((sum, item) => sum + item.credits, 0);

    return {
      featureId: rate.id,
      label: rate.label,
      color: rate.color,
      credits,
      percent: total > 0 ? Math.max(6, Math.round((credits / total) * 100)) : 0
    };
  }).filter((item) => item.credits > 0);
}

function formatLedgerDate(value: number) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value);
}

function getNextRenewalDate() {
  const value = new Date();
  value.setMonth(value.getMonth() + 1);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value);
}

function isBillingPlanId(value: string | null): value is (typeof BILLING_PLANS)[number]["id"] {
  return BILLING_PLANS.some((plan) => plan.id === value);
}
