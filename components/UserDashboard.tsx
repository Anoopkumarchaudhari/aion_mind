"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CreditCard,
  Download,
  History,
  Layers,
  Mail,
  Monitor,
  Receipt,
  ShieldCheck,
  TrendingDown,
  Wallet,
  Zap
} from "lucide-react";
import { downloadInvoice } from "@/lib/invoice";
import type { AdminUserDetail, AdminUserPayment } from "@/services/adminUserDetail";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function UserDashboard() {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState("");
  const [payStatus, setPayStatus] = useState<"all" | "paid" | "failed">("all");
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
            <header className="admin-dash-header">
              <div className="admin-dash-avatar" aria-hidden="true">
                {getInitials(profile.name)}
              </div>
              <div className="admin-dash-identity">
                <p className="eyebrow">My account</p>
                <h1>{profile.name}</h1>
                <span className="admin-detail-email">
                  <Mail size={14} /> {profile.email}
                </span>
                <div className="admin-detail-badges">
                  <span className={`admin-status-pill ${profile.isActive ? "is-active" : "is-inactive"}`}>
                    {profile.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className="admin-plan-tag">{detail.plan.name}</span>
                  <span className="admin-detail-joined">Joined {formatDate(profile.createdAt)}</span>
                </div>
              </div>
            </header>

            <div className="admin-kpi-grid" id="dashboard-usage">
              <Kpi icon={<Wallet size={16} />} label="Credit balance" value={profile.credits.toLocaleString("en-IN")} accent />
              <Kpi icon={<Zap size={16} />} label="Plan allotment" value={`${detail.plan.monthlyCredits.toLocaleString("en-IN")}/mo`} />
              <Kpi icon={<TrendingDown size={16} />} label="Credits spent" value={detail.stats.lifetimeSpent.toLocaleString("en-IN")} />
              <Kpi icon={<CreditCard size={16} />} label="Total paid" value={inr.format(detail.stats.lifetimePurchasedInr)} />
              <Kpi icon={<Activity size={16} />} label="Chats" value={detail.stats.threadCount.toLocaleString("en-IN")} />
              <Kpi icon={<Activity size={16} />} label="Messages" value={detail.stats.messageCount.toLocaleString("en-IN")} />
              <Kpi icon={<Monitor size={16} />} label="Active sessions" value={detail.stats.activeSessions.toLocaleString("en-IN")} />
              <Kpi icon={<Receipt size={16} />} label="Payments" value={`${detail.stats.successfulPayments}/${detail.stats.paymentCount}`} />
            </div>

            <div className="admin-detail-columns">
              <div className="admin-detail-col">
                <Section icon={<ShieldCheck size={15} />} title="Account">
                  <ul className="admin-detail-kv">
                    <KV label="Name" value={profile.name} />
                    <KV label="Email" value={profile.email} />
                    <KV label="Plan" value={detail.plan.name} />
                    <KV label="Plan price" value={detail.plan.priceInr ? inr.format(detail.plan.priceInr) : "Free"} />
                    <KV label="Status" value={profile.isActive ? "Active" : "Inactive"} />
                    <KV label="Member since" value={formatDate(profile.createdAt)} />
                    <KV label="Active sessions" value={String(detail.stats.activeSessions)} />
                  </ul>
                </Section>

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

                <Section icon={<Monitor size={15} />} title={`Sessions (${detail.sessions.length})`}>
                  {detail.sessions.length ? (
                    <ul className="admin-detail-list">
                      {detail.sessions.map((session) => (
                        <li key={session.id} className="admin-detail-row">
                          <span>
                            <strong>{session.active ? "Active session" : "Expired session"}</strong>
                            <small>Started {formatDateTime(session.createdAt)}</small>
                          </span>
                          <span className={`admin-status-pill ${session.active ? "is-active" : "is-inactive"}`}>
                            {session.active ? "Live" : "Ended"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="admin-detail-empty">No sessions on record.</p>
                  )}
                </Section>
              </div>

              <div className="admin-detail-col">
                {(() => {
                  const visiblePayments = detail.payments.filter((p) => matchesPaymentFilter(p, payStatus, payKind));

                  return (
                    <Section
                      icon={<Receipt size={15} />}
                      title={`Payments & invoices (${visiblePayments.length}/${detail.payments.length})`}
                    >
                      {detail.payments.length ? (
                        <div className="admin-detail-filters">
                          <div className="admin-filter-group">
                            {(["all", "paid", "failed"] as const).map((value) => (
                              <button
                                key={value}
                                type="button"
                                className={`admin-filter-chip ${payStatus === value ? "is-active" : ""}`}
                                onClick={() => setPayStatus(value)}
                              >
                                {value === "all" ? "All" : value === "paid" ? "Paid" : "Failed"}
                              </button>
                            ))}
                          </div>
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

                      {detail.payments.length === 0 ? (
                        <p className="admin-detail-empty">No payments yet.</p>
                      ) : visiblePayments.length === 0 ? (
                        <p className="admin-detail-empty">No payments match this filter.</p>
                      ) : (
                        <ul className="admin-detail-list">
                          {visiblePayments.map((payment) => {
                            const isPaid = payment.status === "paid";
                            return (
                              <li key={payment.id} className="admin-detail-row">
                                <span>
                                  <strong>{payment.itemLabel}</strong>
                                  <small>
                                    {formatDateTime(payment.createdAt)} · {inr.format(payment.amountInr)}
                                  </small>
                                </span>
                                {isPaid ? (
                                  <button
                                    className="billing-invoice-button"
                                    type="button"
                                    onClick={() => downloadInvoice(toBillingPayment(payment), { name: profile.name, email: profile.email })}
                                    title="Download PDF invoice"
                                  >
                                    <Download size={14} />
                                    Invoice
                                  </button>
                                ) : (
                                  <span className="billing-status-pill is-api-error">Failed</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Section>
                  );
                })()}

                <Section icon={<History size={15} />} title={`Credit activity (${detail.ledger.length})`}>
                  {detail.ledger.length ? (
                    <ul className="admin-detail-list">
                      {detail.ledger.map((entry) => (
                        <li key={entry.id} className="admin-detail-row">
                          <span>
                            <strong>{entry.label}</strong>
                            <small>
                              {formatDateTime(entry.createdAt)} · {entry.kind}
                              {entry.featureId ? ` · ${entry.featureId}` : ""}
                            </small>
                          </span>
                          <em className={entry.credits < 0 ? "is-negative" : "is-positive"}>
                            {entry.credits > 0 ? "+" : ""}
                            {entry.credits.toLocaleString("en-IN")}
                            <small>bal {entry.balanceAfter.toLocaleString("en-IN")}</small>
                          </em>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="admin-detail-empty">No credit activity yet.</p>
                  )}
                </Section>
              </div>
            </div>
          </motion.div>
        )}
    </section>
  );
}

function matchesPaymentFilter(
  payment: AdminUserPayment,
  status: "all" | "paid" | "failed",
  kind: "all" | "plan" | "topup"
) {
  const statusOk =
    status === "all" ||
    (status === "paid" && payment.status === "paid") ||
    (status === "failed" && payment.status !== "paid");
  const kindOk = kind === "all" || payment.kind === kind;
  return statusOk && kindOk;
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

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`admin-kpi ${accent ? "is-accent" : ""}`}>
      <span className="admin-kpi-icon">{icon}</span>
      <strong>{value}</strong>
      <span className="admin-kpi-label">{label}</span>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <li className="admin-detail-kv-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </li>
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
