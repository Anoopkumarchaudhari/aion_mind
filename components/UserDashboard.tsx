"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, CalendarDays, Download, Layers, Mail, Receipt } from "lucide-react";
import { downloadInvoice } from "@/lib/invoice";
import { ContributionGraph } from "@/components/ContributionGraph";
import { InvoicePreviewButton } from "@/components/InvoicePreviewButton";
import { DashboardCharts } from "@/components/DashboardCharts";
import type { AdminUserDetail, AdminUserPayment } from "@/services/adminUserDetail";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function UserDashboard() {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState("");
  const [payKind, setPayKind] = useState<"all" | "plan" | "topup">("all");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/me/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as AdminUserDetail | { error?: string } | null;
        if (cancelled) return;
        if (!response.ok || !data || "error" in data) {
          setError((data && "error" in data && data.error) || "Could not load your dashboard.");
          return;
        }
        setDetail(data as AdminUserDetail);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your dashboard.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const profile = detail?.profile;

  return (
    <section className="route-content user-dash" id="dashboard-top">
        {error ? (
          <p className="admin-detail-error">{error}</p>
        ) : !detail || !profile ? (
          <p className="admin-detail-empty">Loading your dashboard…</p>
        ) : (
          <motion.div
            className="admin-detail-page-inner user-dash-inner"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <header className="admin-dash-header dash-header">
              <div className="dash-id-row">
                <div className="admin-dash-avatar" aria-hidden="true">
                  {getInitials(profile.name)}
                </div>
                <div className="admin-dash-identity">
                  <p className="eyebrow">My account</p>
                  <h1>{profile.name}</h1>
                  <span className="admin-detail-email">
                    <Mail size={14} /> {profile.email}
                  </span>
                </div>
                <span className={`admin-status-pill ${profile.isActive ? "is-active" : "is-inactive"}`}>
                  {profile.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <dl className="dash-header-meta">
                <div>
                  <dt>Plan</dt>
                  <dd>{detail.plan.name}</dd>
                </div>
                <div>
                  <dt>Plan price</dt>
                  <dd>{detail.plan.priceInr ? inr.format(detail.plan.priceInr) : "Free"}</dd>
                </div>
                <div>
                  <dt>Member since</dt>
                  <dd>{formatDate(profile.createdAt)}</dd>
                </div>
                <div>
                  <dt>Active sessions</dt>
                  <dd>{detail.stats.activeSessions.toLocaleString("en-IN")}</dd>
                </div>
              </dl>
            </header>

            <div className="dash-overview" id="dashboard-usage">
              <section className="dash-balance-hero">
                <div className="dash-balance-main">
                  <p className="eyebrow">Credit balance</p>
                  <strong>{profile.credits.toLocaleString("en-IN")}</strong>
                  <span className="dash-balance-sub">credits available on {detail.plan.name}</span>
                </div>

                <div className="dash-balance-meta">
                  <div className="dash-balance-gauge">
                    <div className="dash-balance-gauge-head">
                      <span>Monthly allotment</span>
                      <span>{detail.plan.monthlyCredits.toLocaleString("en-IN")}/mo</span>
                    </div>
                    <div className="dash-balance-track">
                      <motion.span
                        initial={{ width: 0 }}
                        animate={{
                          width: `${
                            detail.plan.monthlyCredits > 0
                              ? Math.min(100, Math.round((profile.credits / detail.plan.monthlyCredits) * 100))
                              : 0
                          }%`
                        }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  <div className="dash-balance-stats">
                    <div>
                      <strong>{detail.stats.lifetimeSpent.toLocaleString("en-IN")}</strong>
                      <span>Lifetime spent</span>
                    </div>
                    <div>
                      <strong>{inr.format(detail.stats.lifetimePurchasedInr)}</strong>
                      <span>Total paid</span>
                    </div>
                  </div>
                </div>
              </section>

              <div className="admin-kpi-grid">
                <Kpi
                  tone="#a78bfa"
                  label="Chats"
                  value={detail.stats.threadCount.toLocaleString("en-IN")}
                  hint="conversations"
                />
                <Kpi
                  tone="#4f8cff"
                  label="Messages"
                  value={detail.stats.messageCount.toLocaleString("en-IN")}
                  hint={
                    detail.stats.threadCount > 0
                      ? `${Math.round(detail.stats.messageCount / detail.stats.threadCount)}/chat`
                      : "total"
                  }
                />
                <Kpi
                  tone="#fbbf24"
                  label="Active sessions"
                  value={detail.stats.activeSessions.toLocaleString("en-IN")}
                  hint="live now"
                />
                <Kpi
                  tone="#34d399"
                  label="Payments"
                  value={detail.stats.successfulPayments.toLocaleString("en-IN")}
                  hint={
                    detail.stats.failedPayments > 0 ? `${detail.stats.failedPayments} failed` : "all successful"
                  }
                  hintDanger={detail.stats.failedPayments > 0}
                />
              </div>
            </div>

            <div className="dash-charts-section" id="dashboard-insights">
              <h3 className="admin-detail-section-title dash-charts-heading">
                <Activity size={15} /> Insights
              </h3>
              <DashboardCharts detail={detail} />
            </div>

            <div className="dash-charts-section" id="dashboard-activity">
              <h3 className="admin-detail-section-title dash-charts-heading">
                <CalendarDays size={15} /> Activity
              </h3>
              <ContributionGraph detail={detail} />
            </div>

            <div className="admin-detail-columns">
              <div className="admin-detail-col">
                {detail.usageByFeature.length ? (
                  <Section icon={<Layers size={15} />} title="Usage by feature">
                    <ul className="admin-detail-bars">
                      {detail.usageByFeature.map((item) => {
                        const max = detail.usageByFeature[0]?.credits ?? 0;
                        return (
                          <li key={item.featureId}>
                            <div className="admin-bar-head">
                              <strong>{item.label}</strong>
                              <span>
                                {item.credits.toLocaleString("en-IN")} cr · {item.count}×
                              </span>
                            </div>
                            <div className="admin-bar-track">
                              <span style={{ width: `${max ? Math.max(6, (item.credits / max) * 100) : 0}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </Section>
                ) : null}
              </div>

              <div className="admin-detail-col">
                {(() => {
                  const paidPayments = detail.payments.filter(
                    (p) => p.status === "paid" && (payKind === "all" || p.kind === payKind)
                  );
                  const failedCount = detail.payments.filter((p) => p.status !== "paid").length;

                  return (
                    <Section icon={<Receipt size={15} />} title={`Payments & invoices (${paidPayments.length})`}>
                      {detail.payments.length ? (
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
                          {failedCount > 0 ? (
                            <span className="dash-failed-pill" title="Failed payment attempts">
                              {failedCount} failed
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {detail.payments.length === 0 ? (
                        <p className="admin-detail-empty">No payments yet.</p>
                      ) : paidPayments.length === 0 ? (
                        <p className="admin-detail-empty">No successful payments yet.</p>
                      ) : (
                        <ul className="admin-detail-list">
                          {paidPayments.map((payment) => (
                            <li key={payment.id} className="admin-detail-row">
                              <span>
                                <strong>{payment.itemLabel}</strong>
                                <small>
                                  {formatDateTime(payment.createdAt)} · {inr.format(payment.amountInr)}
                                </small>
                              </span>
                              <span className="dash-row-actions">
                                <InvoicePreviewButton
                                  payment={toBillingPayment(payment)}
                                  account={{ name: profile.name, email: profile.email }}
                                />
                                <button
                                  className="billing-invoice-button"
                                  type="button"
                                  onClick={() => downloadInvoice(toBillingPayment(payment), { name: profile.name, email: profile.email })}
                                  title="Download PDF invoice"
                                >
                                  <Download size={14} />
                                  Invoice
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Section>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        )}
    </section>
  );
}

function toBillingPayment(payment: AdminUserPayment) {
  return {
    id: payment.id,
    kind: payment.kind,
    label: payment.itemLabel,
    amountInr: payment.amountInr,
    credits: payment.credits,
    status: payment.status,
    paymentId: payment.paymentId,
    createdAt: payment.createdAt
  };
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="admin-detail-section">
      <h4 className="admin-detail-section-title">
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
  hintDanger
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  hintDanger?: boolean;
}) {
  return (
    <div className="admin-kpi" style={tone ? ({ "--kpi-tone": tone } as React.CSSProperties) : undefined}>
      <strong>{value}</strong>
      <span className="admin-kpi-label">{label}</span>
      {hint ? <span className={`admin-kpi-hint ${hintDanger ? "is-danger" : ""}`}>{hint}</span> : null}
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

function formatDate(value: number) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

function formatDateTime(value: number) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(value);
}
