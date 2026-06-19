"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Ban,
  CalendarClock,
  Coins,
  CreditCard,
  Hash,
  History,
  Layers,
  Mail,
  MessageSquare,
  Monitor,
  Receipt,
  Save,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Wallet,
  Zap
} from "lucide-react";
import type { AdminUserDetail } from "@/services/adminUserDetail";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const DAY_MS = 24 * 60 * 60 * 1000;

export function AdminUserDetailView({ detail }: { detail: AdminUserDetail }) {
  const router = useRouter();
  const { profile, stats, plan } = detail;

  const [planId, setPlanId] = useState(profile.planId);
  const [credits, setCredits] = useState(profile.credits);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");

  const netCredits = stats.lifetimeGranted - stats.lifetimeSpent;
  const accountAgeDays = profile.createdAt ? Math.max(0, Math.floor((Date.now() - profile.createdAt) / DAY_MS)) : 0;
  const messagesPerChat = stats.threadCount ? (stats.messageCount / stats.threadCount).toFixed(1) : "0";
  const topFeature = detail.usageByFeature[0]?.label ?? "—";
  const maxFeatureCredits = detail.usageByFeature[0]?.credits ?? 0;

  function notify(text: string, tone: "ok" | "error") {
    setMessage(text);
    setMessageTone(tone);
  }

  async function callApi(path: string, init: RequestInit, successText: string) {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(path, init);
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        notify(data?.error ?? "Action failed.", "error");
        return false;
      }

      notify(successText, "ok");
      router.refresh();
      return true;
    } catch {
      notify("Network error. Please retry.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function saveBilling() {
    void callApi(
      `/api/admin/users/${encodeURIComponent(profile.id)}/billing`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, credits: Math.max(0, Math.round(credits)) })
      },
      "Plan and credits updated."
    );
  }

  function toggleStatus() {
    void callApi(
      `/api/admin/users/${encodeURIComponent(profile.id)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !profile.isActive })
      },
      profile.isActive ? "User deactivated." : "User activated."
    );
  }

  function revokeSessions() {
    if (!window.confirm("Sign this user out of all active sessions?")) {
      return;
    }
    void callApi(
      `/api/admin/users/${encodeURIComponent(profile.id)}/sessions`,
      { method: "DELETE" },
      "All sessions revoked."
    );
  }

  async function deleteUser() {
    if (!window.confirm(`Permanently delete ${profile.email}? This cannot be undone.`)) {
      return;
    }
    const ok = await callApi(
      `/api/admin/users/${encodeURIComponent(profile.id)}`,
      { method: "DELETE" },
      "User deleted."
    );
    if (ok) {
      router.push("/aria-admin-vault");
    }
  }

  return (
    <main className="admin-detail-page">
      <motion.div
        className="admin-detail-page-inner"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="admin-detail-topbar">
          <Link className="admin-detail-back" href="/aria-admin-vault">
            <ArrowLeft size={16} />
            Back to admin
          </Link>
          {message ? (
            <span className={`admin-detail-flash ${messageTone === "error" ? "is-error" : "is-ok"}`}>{message}</span>
          ) : null}
        </div>

        {/* Identity header */}
        <header className="admin-dash-header">
          <div className="admin-dash-avatar" aria-hidden="true">
            {getInitials(profile.name)}
          </div>
          <div className="admin-dash-identity">
            <p className="eyebrow">User log</p>
            <h1>{profile.name}</h1>
            <span className="admin-detail-email">
              <Mail size={14} /> {profile.email}
            </span>
            <div className="admin-detail-badges">
              <span className={`admin-status-pill ${profile.isActive ? "is-active" : "is-inactive"}`}>
                {profile.isActive ? "Active" : "Inactive"}
              </span>
              <span className="admin-plan-tag">{plan.name}</span>
              {profile.role !== "member" ? <span className="admin-role-pill is-sub">{profile.role}</span> : null}
            </div>
          </div>
          <div className="admin-dash-quickmeta">
            <MetaLine icon={<Hash size={13} />} label="User ID" value={shortId(profile.id)} />
            <MetaLine icon={<CalendarClock size={13} />} label="Joined" value={`${formatDate(profile.createdAt)} · ${accountAgeDays}d ago`} />
            <MetaLine
              icon={<Activity size={13} />}
              label="Last active"
              value={stats.lastActiveAt ? formatDate(stats.lastActiveAt) : "—"}
            />
          </div>
        </header>

        {/* KPI hero */}
        <div className="admin-kpi-grid">
          <Kpi icon={<Wallet size={16} />} label="Balance" value={profile.credits.toLocaleString("en-IN")} accent />
          <Kpi icon={<TrendingUp size={16} />} label="Net credits" value={signed(netCredits)} />
          <Kpi icon={<TrendingDown size={16} />} label="Lifetime spent" value={stats.lifetimeSpent.toLocaleString("en-IN")} />
          <Kpi icon={<Coins size={16} />} label="Purchased" value={inr.format(stats.lifetimePurchasedInr)} />
          <Kpi icon={<MessageSquare size={16} />} label="Chats" value={stats.threadCount.toLocaleString("en-IN")} />
          <Kpi icon={<Activity size={16} />} label="Messages" value={stats.messageCount.toLocaleString("en-IN")} />
          <Kpi icon={<Monitor size={16} />} label="Active sessions" value={stats.activeSessions.toLocaleString("en-IN")} />
          <Kpi icon={<Receipt size={16} />} label="Payments" value={`${stats.successfulPayments}/${stats.paymentCount}`} />
        </div>

        <div className="admin-detail-columns">
          {/* LEFT */}
          <div className="admin-detail-col">
            <Section icon={<ShieldCheck size={15} />} title="Account">
              <ul className="admin-detail-kv">
                <KV label="Full name" value={profile.name} />
                <KV label="Email" value={profile.email} />
                <KV label="User ID" value={profile.id} mono />
                <KV label="Role" value={profile.role} />
                <KV label="Status" value={profile.isActive ? "Active" : "Inactive"} />
                <KV label="Account age" value={`${accountAgeDays} days`} />
                <KV label="Messages / chat" value={messagesPerChat} />
                <KV label="Top feature" value={topFeature} />
                <KV label="Total sessions" value={`${stats.totalSessions} (${stats.activeSessions} live)`} />
                <KV label="Failed payments" value={String(stats.failedPayments)} />
              </ul>
            </Section>

            <Section icon={<CreditCard size={15} />} title="Plan & wallet">
              <div className="admin-detail-grid">
                <Stat label="Current plan" value={plan.name} />
                <Stat label="Plan price" value={plan.priceInr ? inr.format(plan.priceInr) : "Free"} />
                <Stat label="Monthly allotment" value={`${plan.monthlyCredits.toLocaleString("en-IN")}/mo`} />
                <Stat label="Lifetime granted" value={`+${stats.lifetimeGranted.toLocaleString("en-IN")}`} />
              </div>
            </Section>

            {detail.usageByFeature.length ? (
              <Section icon={<Layers size={15} />} title="Usage by feature">
                <ul className="admin-detail-bars">
                  {detail.usageByFeature.map((item) => (
                    <li key={item.featureId}>
                      <div className="admin-bar-head">
                        <strong>{item.label}</strong>
                        <span>
                          {item.credits.toLocaleString("en-IN")} cr · {item.count}×
                        </span>
                      </div>
                      <div className="admin-bar-track">
                        <span
                          style={{ width: `${maxFeatureCredits ? Math.max(6, (item.credits / maxFeatureCredits) * 100) : 0}%` }}
                        />
                      </div>
                    </li>
                  ))}
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

          {/* RIGHT */}
          <div className="admin-detail-col">
            {/* Management */}
            <Section icon={<Save size={15} />} title="Manage account">
              <div className="admin-manage">
                <label className="admin-manage-field">
                  <span>Plan</span>
                  <select
                    value={planId}
                    disabled={busy}
                    onChange={(event) => setPlanId(event.target.value)}
                  >
                    {detail.planOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-manage-field">
                  <span>Credits balance</span>
                  <div className="admin-manage-credits">
                    <button type="button" disabled={busy} onClick={() => setCredits((value) => Math.max(0, value - 50))}>
                      −50
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={credits}
                      disabled={busy}
                      onChange={(event) => setCredits(Math.max(0, Number(event.target.value) || 0))}
                    />
                    <button type="button" disabled={busy} onClick={() => setCredits((value) => value + 50)}>
                      +50
                    </button>
                  </div>
                </label>
                <button className="primary-button full" type="button" disabled={busy} onClick={saveBilling}>
                  <Save size={15} /> Save changes
                </button>

                <div className="admin-manage-actions">
                  <button
                    className={`ghost-button ${profile.isActive ? "is-danger-action" : "is-success-action"}`}
                    type="button"
                    disabled={busy}
                    onClick={toggleStatus}
                  >
                    {profile.isActive ? <Ban size={14} /> : <UserCheck size={14} />}
                    {profile.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button className="ghost-button" type="button" disabled={busy} onClick={revokeSessions}>
                    <Monitor size={14} /> Revoke sessions
                  </button>
                  <button className="ghost-button is-danger-action" type="button" disabled={busy} onClick={deleteUser}>
                    <Trash2 size={14} /> Delete user
                  </button>
                </div>
              </div>
            </Section>

            <Section icon={<Zap size={15} />} title={`Plan history (${detail.planHistory.length})`}>
              {detail.planHistory.length ? (
                <ul className="admin-detail-list">
                  {detail.planHistory.map((item, index) => (
                    <li key={`${item.planId}-${index}`} className="admin-detail-row">
                      <span>
                        <strong>{item.label}</strong>
                        <small>{formatDateTime(item.createdAt)}</small>
                      </span>
                      <StatusPill status={item.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-detail-empty">No plan purchases yet.</p>
              )}
            </Section>

            <Section icon={<Receipt size={15} />} title={`Payments (${detail.payments.length})`}>
              {detail.payments.length ? (
                <ul className="admin-detail-list">
                  {detail.payments.map((payment) => (
                    <li key={payment.id} className="admin-detail-row">
                      <span>
                        <strong>{payment.itemLabel}</strong>
                        <small>
                          {formatDateTime(payment.createdAt)} · {inr.format(payment.amountInr)} · +
                          {payment.credits.toLocaleString("en-IN")} cr
                        </small>
                      </span>
                      <StatusPill status={payment.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-detail-empty">No payments yet.</p>
              )}
            </Section>

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
    </main>
  );
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-detail-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <li className="admin-detail-kv-row">
      <span>{label}</span>
      <strong className={mono ? "is-mono" : ""}>{value}</strong>
    </li>
  );
}

function MetaLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span className="admin-dash-meta-line">
      {icon}
      <small>{label}</small>
      {value}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const ok = status === "paid";
  return (
    <span className={`billing-status-pill ${ok ? "is-available" : "is-api-error"}`}>{ok ? "Paid" : status}</span>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-IN")}`;
}

function formatDate(value: number) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

function formatDateTime(value: number) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}
