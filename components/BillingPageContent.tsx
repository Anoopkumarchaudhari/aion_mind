"use client";

import { useEffect, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  CreditCard,
  Plus,
  Receipt,
  ShieldCheck,
  Wallet,
  Zap
} from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { BillingSidebar } from "@/components/BillingSidebar";
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
  BILLING_TOP_UP_PACKS,
  FEATURE_CREDIT_RATES,
  getAvailableCredits,
  getBillingPlan,
  getCreditUsagePercent,
  getMonthlyRemainingCredits,
  useBillingStore,
  type BillingFeatureId
} from "@/store/useBillingStore";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

export function BillingPageContent() {
  const billing = useBillingStore();
  const currentPlan = getBillingPlan(billing.planId);
  const availableCredits = getAvailableCredits(billing);
  const monthlyRemaining = getMonthlyRemainingCredits(billing);
  const usedPercent = getCreditUsagePercent(billing);
  const usageSummary = getUsageSummary(billing.usage);
  const nextRenewalDate = getNextRenewalDate();

  useEffect(() => {
    const planId = new URLSearchParams(window.location.search).get("plan");

    if (isBillingPlanId(planId)) {
      if (planId !== useBillingStore.getState().planId) {
        useBillingStore.getState().selectPlan(planId);
      }

      window.history.replaceState(null, "", "/billing");
    }
  }, []);

  return (
    <AppFrame
      title="Billing"
      sidebar={(sidebarProps) => (
        <BillingSidebar
          {...sidebarProps}
          planName={currentPlan.name}
          availableCredits={availableCredits}
          monthlyRemaining={monthlyRemaining}
          topUpCredits={billing.topUpCredits}
          usedPercent={usedPercent}
          nextRenewalDate={nextRenewalDate}
          autoTopUpEnabled={billing.autoTopUpEnabled}
        />
      )}
    >
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
            <span className="billing-renewal-pill">Renews {nextRenewalDate}</span>
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
            <span>Top-up credits</span>
            <strong>{billing.topUpCredits.toLocaleString("en-IN")}</strong>
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
            {BILLING_PLANS.map((plan) => {
              const isActive = plan.id === billing.planId;

              return (
                <motion.article
                  className={`billing-plan-card ${isActive ? "is-active" : ""}`}
                  key={plan.id}
                  style={{ "--plan-color": plan.accent } as CSSProperties}
                  variants={scrollItemVariants}
                  whileHover={hoverLift}
                >
                  <div className="billing-plan-topline">
                    <span>{plan.name}</span>
                    {isActive ? <CheckCircle2 size={16} /> : null}
                  </div>
                  <strong>{inrFormatter.format(plan.priceInr)}</strong>
                  <p>{plan.monthlyCredits.toLocaleString("en-IN")} credits / month</p>
                  <small>{plan.note}</small>
                  <button
                    className={isActive ? "ghost-button full" : "primary-button full"}
                    type="button"
                    onClick={() => billing.selectPlan(plan.id)}
                    disabled={isActive}
                  >
                    {isActive ? "Current plan" : "Choose plan"}
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
            id="billing-rates"
            className="billing-panel"
            aria-labelledby="credit-rates-heading"
            variants={scrollItemVariants}
          >
            <div className="billing-panel-heading">
              <span className="billing-icon small">
                <Zap size={17} />
              </span>
              <div>
                <p className="eyebrow">Rates</p>
                <h3 id="credit-rates-heading">Feature credit costs</h3>
              </div>
            </div>
            <div className="billing-rate-list">
              {FEATURE_CREDIT_RATES.map((item) => (
                <motion.div className="billing-rate-row" key={item.id} whileHover={hoverLift}>
                  <span style={{ background: item.color }} />
                  <strong>{item.label}</strong>
                  <em>{item.credits} credits</em>
                </motion.div>
              ))}
            </div>
          </motion.section>

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
              {BILLING_TOP_UP_PACKS.map((pack) => (
                <motion.div className="billing-topup-row" key={pack.id} whileHover={hoverLift}>
                  <div>
                    <strong>{pack.name}</strong>
                    <span>{pack.credits.toLocaleString("en-IN")} credits</span>
                  </div>
                  <button className="ghost-button" type="button" onClick={() => billing.buyTopUp(pack.id)}>
                    {inrFormatter.format(pack.priceInr)}
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
                  <Receipt size={16} />
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
    </AppFrame>
  );
}

function getUsageSummary(usage: Array<{ featureId: BillingFeatureId; credits: number }>) {
  const total = usage.reduce((sum, item) => sum + item.credits, 0);

  return FEATURE_CREDIT_RATES.map((rate) => {
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
