"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CreditCard,
  Database,
  KeyRound,
  LogOut,
  RefreshCw,
  Route,
  Settings2,
  ShieldCheck,
  Users,
  Wallet
} from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { ModelRoutingDrawer } from "@/components/ModelRoutingDrawer";
import {
  hoverLift,
  scrollContainerVariants,
  scrollItemVariants,
  scrollRevealVariants,
  scrollRevealViewport
} from "@/lib/motion";
import type { AdminOverview } from "@/services/adminOverview";
import type { ProviderModelBalancesPayload } from "@/services/providerModelBalances";

type AdminPanelContentProps = {
  initialOverview: AdminOverview;
};

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

export function AdminPanelContent({ initialOverview }: AdminPanelContentProps) {
  const [overview, setOverview] = useState(initialOverview);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [routingOpen, setRoutingOpen] = useState(false);
  const [modelBalances, setModelBalances] = useState<ProviderModelBalancesPayload | null>(null);
  const [modelBalanceError, setModelBalanceError] = useState("");
  const [modelBalancesLoading, setModelBalancesLoading] = useState(true);

  useEffect(() => {
    void refreshModelBalances();
  }, []);

  async function refreshOverview() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const data = (await response.json()) as AdminOverview | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Could not refresh admin data.");
      }

      setOverview(data as AdminOverview);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh admin data.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshModelBalances() {
    setModelBalancesLoading(true);
    setModelBalanceError("");

    try {
      const response = await fetch("/api/admin/model-balances", {
        cache: "no-store"
      });
      const data = (await response.json()) as ProviderModelBalancesPayload | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Could not fetch model balances.");
      }

      setModelBalances(data as ProviderModelBalancesPayload);
    } catch (error) {
      setModelBalanceError(error instanceof Error ? error.message : "Could not fetch model balances.");
    } finally {
      setModelBalancesLoading(false);
    }
  }

  async function revokeSessions(userId: string, label: string) {
    if (!window.confirm(`Revoke active sessions for ${label}?`)) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/sessions`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { revoked?: number; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not revoke sessions.");
      }

      setMessage(`${data.revoked ?? 0} session${data.revoked === 1 ? "" : "s"} revoked.`);
      await refreshOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not revoke sessions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppFrame title="Admin">
      <section className="route-content admin-route">
        <motion.div
          className="page-toolbar admin-toolbar"
          variants={scrollRevealVariants}
          initial="hidden"
          animate="show"
        >
          <div>
            <p className="eyebrow">Private control</p>
            <h2>Admin panel</h2>
          </div>
          <div className="admin-toolbar-actions">
            {message ? <span className="admin-action-message">{message}</span> : null}
            <button
              className="ghost-button"
              type="button"
              onClick={() => void refreshOverview()}
              disabled={loading}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
            <button className="primary-button" type="button" onClick={() => setRoutingOpen(true)}>
              <Settings2 size={15} />
              Model routing
            </button>
          </div>
        </motion.div>

        <motion.section
          className="admin-stat-grid"
          aria-label="Admin overview"
          variants={scrollContainerVariants}
          initial="hidden"
          animate="show"
        >
          <AdminStat icon={<Users size={18} />} label="Users" value={formatStat(overview.stats.users)} />
          <AdminStat
            icon={<Activity size={18} />}
            label="Sessions"
            value={formatStat(overview.stats.activeSessions)}
          />
          <AdminStat
            icon={<Route size={18} />}
            label="Chat threads"
            value={formatStat(overview.stats.chatThreads)}
          />
          <AdminStat
            icon={<ShieldCheck size={18} />}
            label="Admin"
            value={overview.admin.name}
            detail={overview.admin.email}
          />
        </motion.section>

        <motion.div
          className="admin-dashboard-grid"
          variants={scrollContainerVariants}
          initial="hidden"
          whileInView="show"
          viewport={scrollRevealViewport}
        >
          <motion.section
            className="admin-panel admin-panel-wide"
            aria-labelledby="admin-model-balances-heading"
            variants={scrollItemVariants}
          >
            <div className="admin-panel-heading admin-model-balance-heading">
              <span className="admin-panel-icon">
                <KeyRound size={17} />
              </span>
              <div>
                <p className="eyebrow">Provider APIs</p>
                <h3 id="admin-model-balances-heading">Actual model balances</h3>
              </div>
              <div className="admin-model-balance-actions">
                <span>
                  {modelBalances
                    ? `Updated ${formatModelBalanceTime(modelBalances.generatedAt)}`
                    : "Waiting for provider data"}
                </span>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => void refreshModelBalances()}
                  disabled={modelBalancesLoading}
                >
                  <RefreshCw size={15} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="billing-model-table-shell">
              {modelBalanceError ? (
                <div className="billing-model-empty">{modelBalanceError}</div>
              ) : null}
              {modelBalancesLoading && !modelBalances ? (
                <div className="billing-model-empty">Fetching provider model data...</div>
              ) : null}
              {modelBalances ? (
                <>
                  <table className="billing-model-table">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Model</th>
                        <th>Status</th>
                        <th>Input / 1M</th>
                        <th>Output / 1M</th>
                        <th>Budget left</th>
                        <th>Input tokens left</th>
                        <th>Output tokens left</th>
                        <th>Context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelBalances.rows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.providerLabel}</td>
                          <td>
                            <strong>{row.label}</strong>
                            <span>{row.model}</span>
                            <small>{row.routes.join(", ")}</small>
                            {row.note ? <em>{row.note}</em> : null}
                          </td>
                          <td>
                            <span className={`billing-status-pill is-${row.liveStatus}`}>
                              {row.liveStatusLabel}
                            </span>
                            {row.enabled ? null : <small>Disabled route</small>}
                          </td>
                          <td>{formatUsdPerMillion(row.inputUsdPerMillion)}</td>
                          <td>{formatUsdPerMillion(row.outputUsdPerMillion)}</td>
                          <td>{formatUsd(row.remainingUsd)}</td>
                          <td>{formatTokenCount(row.inputTokensLeft)}</td>
                          <td>{formatTokenCount(row.outputTokensLeft)}</td>
                          <td>{formatContextLimit(row.contextWindowTokens, row.outputLimitTokens)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="billing-model-notes">
                    {modelBalances.notes.map((note) => (
                      <span key={note}>{note}</span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </motion.section>

          <motion.section
            className="admin-panel admin-panel-wide"
            aria-labelledby="admin-users-heading"
            variants={scrollItemVariants}
          >
            <div className="admin-panel-heading">
              <span className="admin-panel-icon">
                <Users size={17} />
              </span>
              <div>
                <p className="eyebrow">Access</p>
                <h3 id="admin-users-heading">Users and sessions</h3>
              </div>
            </div>
            <div className="admin-table-shell">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Joined</th>
                    <th>Chats</th>
                    <th>Messages</th>
                    <th>Sessions</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {overview.users.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No user records available.</td>
                    </tr>
                  ) : (
                    overview.users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.name}</strong>
                          <span>{user.email}</span>
                        </td>
                        <td>{formatDate(user.createdAt)}</td>
                        <td>{user.threadCount.toLocaleString("en-IN")}</td>
                        <td>{user.messageCount.toLocaleString("en-IN")}</td>
                        <td>{user.activeSessions.toLocaleString("en-IN")}</td>
                        <td>
                          <button
                            className="ghost-button admin-table-action"
                            type="button"
                            disabled={loading || user.isCurrentAdmin || user.activeSessions === 0}
                            onClick={() => void revokeSessions(user.id, user.email)}
                          >
                            <LogOut size={14} />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.section>

          <motion.section className="admin-panel" aria-labelledby="admin-providers-heading" variants={scrollItemVariants}>
            <div className="admin-panel-heading">
              <span className="admin-panel-icon">
                <KeyRound size={17} />
              </span>
              <div>
                <p className="eyebrow">Providers</p>
                <h3 id="admin-providers-heading">API status</h3>
              </div>
            </div>
            <div className="admin-list">
              {overview.providers.map((provider) => (
                <motion.div className="admin-list-row" key={provider.id} whileHover={hoverLift}>
                  <div>
                    <strong>{provider.label}</strong>
                    <span>{provider.modelCount} configured models</span>
                  </div>
                  <span className={`admin-status-pill ${provider.apiKeyConfigured ? "is-ready" : "is-missing"}`}>
                    {provider.apiKeyConfigured ? "Ready" : "Missing"}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section className="admin-panel" aria-labelledby="admin-routing-heading" variants={scrollItemVariants}>
            <div className="admin-panel-heading">
              <span className="admin-panel-icon">
                <Route size={17} />
              </span>
              <div>
                <p className="eyebrow">Routing</p>
                <h3 id="admin-routing-heading">Model routes</h3>
              </div>
            </div>
            <div className="admin-route-list">
              {overview.routing.map((route) => (
                <motion.div className="admin-route-row" key={route.label} whileHover={hoverLift}>
                  <strong>{route.label}</strong>
                  {route.slots.map((slot) => (
                    <span key={slot.id}>
                      {slot.enabled ? "On" : "Off"} / {slot.provider} / {slot.model}
                    </span>
                  ))}
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section className="admin-panel" aria-labelledby="admin-config-heading" variants={scrollItemVariants}>
            <div className="admin-panel-heading">
              <span className="admin-panel-icon">
                <Database size={17} />
              </span>
              <div>
                <p className="eyebrow">System</p>
                <h3 id="admin-config-heading">Configuration</h3>
              </div>
            </div>
            <div className="admin-list">
              {overview.config.map((item) => (
                <motion.div className="admin-list-row" key={item.label} whileHover={hoverLift}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <span className={`admin-status-pill is-${item.status}`}>
                    {item.status === "ready" ? "Ready" : "Missing"}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            className="admin-panel admin-panel-wide"
            aria-labelledby="admin-billing-heading"
            variants={scrollItemVariants}
          >
            <div className="admin-panel-heading">
              <span className="admin-panel-icon">
                <Wallet size={17} />
              </span>
              <div>
                <p className="eyebrow">Credits</p>
                <h3 id="admin-billing-heading">Billing catalog</h3>
              </div>
            </div>
            <div className="admin-billing-grid">
              {overview.billing.plans.map((plan) => (
                <motion.article className="admin-billing-card" key={plan.id} whileHover={hoverLift}>
                  <span style={{ background: plan.accent }} />
                  <strong>{plan.name}</strong>
                  <em>{inrFormatter.format(plan.priceInr)}</em>
                  <small>{plan.monthlyCredits.toLocaleString("en-IN")} credits</small>
                </motion.article>
              ))}
            </div>
            <div className="admin-mini-grid">
              <div className="admin-mini-panel">
                <div className="admin-mini-heading">
                  <CreditCard size={15} />
                  Top-ups
                </div>
                {overview.billing.topUps.map((pack) => (
                  <span key={pack.id}>
                    {pack.name}: {inrFormatter.format(pack.priceInr)} / {pack.credits} credits
                  </span>
                ))}
              </div>
              <div className="admin-mini-panel">
                <div className="admin-mini-heading">
                  <Activity size={15} />
                  Feature rates
                </div>
                {overview.billing.featureRates.map((rate) => (
                  <span key={rate.id}>
                    {rate.label}: {rate.credits}
                  </span>
                ))}
              </div>
            </div>
          </motion.section>
        </motion.div>
      </section>

      <ModelRoutingDrawer open={routingOpen} initialTab="aion" onOpenChange={setRoutingOpen} />
    </AppFrame>
  );
}

function AdminStat({
  icon,
  label,
  value,
  detail
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <motion.article className="admin-stat-card" variants={scrollItemVariants} whileHover={hoverLift}>
      <span className="admin-panel-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </motion.article>
  );
}

function formatStat(value: number | null) {
  return value === null ? "-" : value.toLocaleString("en-IN");
}

function formatDate(value: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(value);
}

function formatModelBalanceTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatUsd(value: number | null) {
  return value === null ? "-" : usdFormatter.format(value);
}

function formatUsdPerMillion(value: number | null) {
  return value === null ? "-" : `${usdFormatter.format(value)} / 1M`;
}

function formatTokenCount(value: number | null) {
  if (value === null) {
    return "-";
  }

  if (value >= 1_000_000) {
    return `${trimTrailingZeros(value / 1_000_000)}M`;
  }

  if (value >= 1_000) {
    return `${trimTrailingZeros(value / 1_000)}K`;
  }

  return value.toLocaleString("en-IN");
}

function formatContextLimit(input?: number, output?: number) {
  if (!input && !output) {
    return "-";
  }

  return [input ? `${formatTokenCount(input)} in` : "", output ? `${formatTokenCount(output)} out` : ""]
    .filter(Boolean)
    .join(" / ");
}

function trimTrailingZeros(value: number) {
  return value.toFixed(value >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}
