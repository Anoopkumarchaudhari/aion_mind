"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Coins,
  CreditCard,
  Database,
  Eye,
  KeyRound,
  LogOut,
  Megaphone,
  Pencil,
  Power,
  RefreshCw,
  Route,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Wallet,
  Wrench
} from "lucide-react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AppFrame } from "@/components/AppFrame";
import { ModelRoutingDrawer } from "@/components/ModelRoutingDrawer";
import {
  hoverLift,
  scrollContainerVariants,
  scrollItemVariants,
  scrollRevealVariants
} from "@/lib/motion";
import type { AdminOverview } from "@/services/adminOverview";
import type { AnnouncementTone, FeatureFlags, ProviderBudgets } from "@/services/adminSettings";
import type { ProviderModelBalancesPayload } from "@/services/providerModelBalances";

type AdminPanelContentProps = {
  initialOverview: AdminOverview;
};

type AdminUserRecord = AdminOverview["users"][number];

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const ANNOUNCEMENT_TONES: AnnouncementTone[] = ["info", "success", "warning", "danger"];

export function AdminPanelContent({ initialOverview }: AdminPanelContentProps) {
  const [overview, setOverview] = useState(initialOverview);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [routingOpen, setRoutingOpen] = useState(false);
  const [modelBalances, setModelBalances] = useState<ProviderModelBalancesPayload | null>(null);
  const [modelBalanceError, setModelBalanceError] = useState("");
  const [modelBalancesLoading, setModelBalancesLoading] = useState(true);

  const [userSearch, setUserSearch] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);

  const [flags, setFlags] = useState<FeatureFlags>(initialOverview.featureFlags);
  const [flagsSaving, setFlagsSaving] = useState(false);

  const [budgets, setBudgets] = useState<ProviderBudgets>(initialOverview.providerBudgets);
  const [budgetsSaving, setBudgetsSaving] = useState(false);

  const [billingDraft, setBillingDraft] = useState(initialOverview.billing);
  const [billingSaving, setBillingSaving] = useState(false);

  const [admins, setAdmins] = useState(initialOverview.admins);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const isSuperAdmin = overview.admin.isSuperAdmin;

  async function addSubAdmin(event: React.FormEvent) {
    event.preventDefault();
    const email = newAdminEmail.trim();

    if (!email) {
      return;
    }

    setAdminBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = (await response.json()) as { members?: typeof admins; error?: string };

      if (!response.ok || !data.members) {
        throw new Error(data.error || "Could not add sub-admin.");
      }

      setAdmins(data.members);
      setNewAdminEmail("");
      setMessage(`Added ${email} as a sub-admin.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add sub-admin.");
    } finally {
      setAdminBusy(false);
    }
  }

  async function removeSubAdmin(email: string) {
    if (!window.confirm(`Remove ${email} as a sub-admin? Their admin access ends immediately.`)) {
      return;
    }

    setAdminBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = (await response.json()) as { members?: typeof admins; error?: string };

      if (!response.ok || !data.members) {
        throw new Error(data.error || "Could not remove sub-admin.");
      }

      setAdmins(data.members);
      setMessage(`Removed ${email}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove sub-admin.");
    } finally {
      setAdminBusy(false);
    }
  }

  useEffect(() => {
    void refreshModelBalances();
  }, []);

  async function handleLogout() {
    if (!window.confirm("Lock the admin panel? You'll need your password and a new code to return.")) {
      return;
    }

    setLoggingOut(true);

    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // Even if the request fails, refresh so the gate re-evaluates the session.
    } finally {
      router.refresh();
    }
  }

  async function refreshOverview() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const data = (await response.json()) as AdminOverview | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Could not refresh admin data.");
      }

      const next = data as AdminOverview;
      setOverview(next);
      setFlags(next.featureFlags);
      setBudgets(next.providerBudgets);
      setBillingDraft(next.billing);
      setAdmins(next.admins);
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
      const response = await fetch("/api/admin/model-balances", { cache: "no-store" });
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

  async function toggleUserStatus(user: AdminUserRecord) {
    const nextIsActive = !user.isActive;
    const nextStatusLabel = nextIsActive ? "active" : "inactive";
    const confirmation = nextIsActive
      ? `Set ${user.email} active?`
      : `Set ${user.email} inactive? This will end their active sessions.`;

    if (!window.confirm(confirmation)) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextIsActive })
      });
      const data = (await response.json()) as { revoked?: number; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not update user status.");
      }

      const revoked = data.revoked ?? 0;
      const sessionMessage = revoked ? ` ${revoked} session${revoked === 1 ? "" : "s"} ended.` : "";

      setMessage(`${user.email} is now ${nextStatusLabel}.${sessionMessage}`);
      await refreshOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update user status.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(user: AdminUserRecord) {
    if (!window.confirm(`Delete ${user.email}? This permanently removes their account, chats, and sessions.`)) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not delete user.");
      }

      setMessage(`${user.email} was deleted.`);
      await refreshOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete user.");
    } finally {
      setLoading(false);
    }
  }

  async function saveUserBilling(user: AdminUserRecord, changes: { planId: string; credits: number; role: string }) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/billing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes)
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not update user billing.");
      }

      setMessage(`Updated ${user.email}: ${changes.planId} plan, ${changes.credits} credits.`);
      setEditingUser(null);
      await refreshOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update user billing.");
    } finally {
      setLoading(false);
    }
  }

  async function saveFlags() {
    setFlagsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureFlags: flags })
      });
      const data = (await response.json()) as { featureFlags?: FeatureFlags; error?: string };

      if (!response.ok || !data.featureFlags) {
        throw new Error(data.error || "Could not save system settings.");
      }

      setFlags(data.featureFlags);
      setOverview((current) => ({ ...current, featureFlags: data.featureFlags as FeatureFlags }));
      setMessage("System settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save system settings.");
    } finally {
      setFlagsSaving(false);
    }
  }

  async function saveBudgets() {
    setBudgetsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerBudgets: budgets })
      });
      const data = (await response.json()) as { providerBudgets?: ProviderBudgets; error?: string };

      if (!response.ok || !data.providerBudgets) {
        throw new Error(data.error || "Could not save provider budgets.");
      }

      setBudgets(data.providerBudgets);
      setOverview((current) => ({ ...current, providerBudgets: data.providerBudgets as ProviderBudgets }));
      setMessage("Provider budgets saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save provider budgets.");
    } finally {
      setBudgetsSaving(false);
    }
  }

  async function saveBilling() {
    setBillingSaving(true);
    setMessage("");

    const overrides = {
      plans: Object.fromEntries(
        billingDraft.plans.map((plan) => [
          plan.id,
          { priceInr: plan.priceInr, monthlyCredits: plan.monthlyCredits, note: plan.note }
        ])
      ),
      topUps: Object.fromEntries(
        billingDraft.topUps.map((pack) => [pack.id, { priceInr: pack.priceInr, credits: pack.credits }])
      ),
      featureRates: Object.fromEntries(billingDraft.featureRates.map((rate) => [rate.id, { credits: rate.credits }]))
    };

    try {
      const response = await fetch("/api/admin/billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrides)
      });
      const data = (await response.json()) as { catalog?: AdminOverview["billing"]; error?: string };

      if (!response.ok || !data.catalog) {
        throw new Error(data.error || "Could not save billing catalog.");
      }

      setBillingDraft(data.catalog);
      setOverview((current) => ({ ...current, billing: data.catalog as AdminOverview["billing"] }));
      setMessage("Billing catalog saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save billing catalog.");
    } finally {
      setBillingSaving(false);
    }
  }

  const search = userSearch.trim().toLowerCase();
  const visibleUsers = search
    ? overview.users.filter(
        (user) => user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search)
      )
    : overview.users;

  return (
    <AppFrame
      title="Admin"
      sidebar={(sidebarProps) => (
        <AdminSidebar {...sidebarProps} overview={overview} modelBalances={modelBalances} />
      )}
    >
      <section className="route-content admin-route">
        <motion.div
          className="page-toolbar admin-toolbar"
          variants={scrollRevealVariants}
          initial="hidden"
          animate="show"
        >
          <div>
            <p className="eyebrow">Private control</p>
            <h2>Admin control center</h2>
          </div>
          <div className="admin-toolbar-actions">
            {message ? <span className="admin-action-message">{message}</span> : null}
            <button className="ghost-button" type="button" onClick={() => void refreshOverview()} disabled={loading}>
              <RefreshCw size={15} />
              Refresh
            </button>
            <button className="primary-button" type="button" onClick={() => setRoutingOpen(true)}>
              <Settings2 size={15} />
              Model routing
            </button>
            <button
              className="ghost-button is-danger-action"
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
            >
              <LogOut size={15} />
              {loggingOut ? "Locking..." : "Log out"}
            </button>
          </div>
        </motion.div>

        <motion.section
          id="admin-overview"
          className="admin-stat-grid"
          aria-label="Admin overview"
          variants={scrollContainerVariants}
          initial="hidden"
          animate="show"
        >
          <AdminStat icon={<Users size={18} />} label="Users" value={formatStat(overview.stats.users)} tone="blue" />
          <AdminStat
            icon={<Activity size={18} />}
            label="Sessions"
            value={formatStat(overview.stats.activeSessions)}
            tone="green"
          />
          <AdminStat
            icon={<Route size={18} />}
            label="Chat threads"
            value={formatStat(overview.stats.chatThreads)}
            tone="gold"
          />
          <AdminStat
            icon={<ShieldCheck size={18} />}
            label="Admin"
            value={overview.admin.name}
            detail={overview.admin.email}
            tone="red"
          />
        </motion.section>

        <motion.div
          className="admin-dashboard-grid"
          variants={scrollContainerVariants}
          initial="hidden"
          animate="show"
        >
          {/* ---- System & feature flags ---- */}
          <motion.section
            id="admin-system"
            className="admin-panel admin-panel-wide admin-accent-gold"
            aria-labelledby="admin-system-heading"
            variants={scrollItemVariants}
          >
            <div className="admin-panel-heading">
              <span className="admin-panel-icon">
                <Power size={17} />
              </span>
              <div>
                <p className="eyebrow">System</p>
                <h3 id="admin-system-heading">Feature flags and broadcast</h3>
              </div>
              <div className="admin-model-balance-actions">
                <button className="primary-button" type="button" onClick={() => void saveFlags()} disabled={flagsSaving}>
                  <Save size={15} />
                  {flagsSaving ? "Saving..." : "Save system"}
                </button>
              </div>
            </div>

            <div className="admin-flag-grid">
              <AdminToggleRow
                icon={<UserCheck size={16} />}
                label="Account signup"
                detail="Allow new users to create accounts."
                checked={flags.signupEnabled}
                onChange={(value) => setFlags((current) => ({ ...current, signupEnabled: value }))}
              />
              <AdminToggleRow
                icon={<Wrench size={16} />}
                label="Maintenance mode"
                detail="Flag the workspace as under maintenance."
                tone="danger"
                checked={flags.maintenanceMode}
                onChange={(value) => setFlags((current) => ({ ...current, maintenanceMode: value }))}
              />
            </div>

            <div className="admin-announcement">
              <div className="admin-announcement-head">
                <Megaphone size={16} />
                <span>Broadcast announcement</span>
                <AdminSwitch
                  checked={flags.announcement.enabled}
                  onChange={(value) =>
                    setFlags((current) => ({
                      ...current,
                      announcement: { ...current.announcement, enabled: value }
                    }))
                  }
                />
              </div>
              <textarea
                className="admin-input admin-textarea"
                placeholder="Message shown to all users (max 280 chars)"
                maxLength={280}
                value={flags.announcement.message}
                onChange={(event) =>
                  setFlags((current) => ({
                    ...current,
                    announcement: { ...current.announcement, message: event.target.value }
                  }))
                }
              />
              <div className="admin-tone-row">
                {ANNOUNCEMENT_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    className={`admin-tone-chip is-${tone} ${flags.announcement.tone === tone ? "is-selected" : ""}`}
                    onClick={() =>
                      setFlags((current) => ({
                        ...current,
                        announcement: { ...current.announcement, tone }
                      }))
                    }
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
          </motion.section>

          {/* ---- Users and sessions ---- */}
          <motion.section
            id="admin-users"
            className="admin-panel admin-panel-wide admin-accent-blue"
            aria-labelledby="admin-users-heading"
            variants={scrollItemVariants}
          >
            <div className="admin-panel-heading">
              <span className="admin-panel-icon">
                <Users size={17} />
              </span>
              <div>
                <p className="eyebrow">Access</p>
                <h3 id="admin-users-heading">Users, plans and credits</h3>
              </div>
              <div className="admin-search">
                <Search size={15} />
                <input
                  type="search"
                  placeholder="Search name or email"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="admin-table-shell">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                    <th>Plan</th>
                    <th>Credits</th>
                    <th>Chats</th>
                    <th>Sessions</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7}>{overview.users.length ? "No users match your search." : "No user records available."}</td>
                    </tr>
                  ) : (
                    visibleUsers.map((user) => (
                      <tr className={user.isActive ? undefined : "is-inactive-user"} key={user.id}>
                        <td>
                          <button
                            className="admin-user-link"
                            type="button"
                            onClick={() => router.push(`/aria-admin-vault/users/${encodeURIComponent(user.id)}`)}
                            title="View full activity log"
                          >
                            <strong>{user.name}</strong>
                            <span>{user.email}</span>
                          </button>
                        </td>
                        <td>
                          <span className={`admin-status-pill ${user.isActive ? "is-active" : "is-inactive"}`}>
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <span className="admin-plan-tag">{user.planId}</span>
                          {user.role !== "member" ? <small>{user.role}</small> : null}
                        </td>
                        <td>
                          <span className="admin-credit-value">{user.credits.toLocaleString("en-IN")}</span>
                        </td>
                        <td>{user.threadCount.toLocaleString("en-IN")}</td>
                        <td>{user.activeSessions.toLocaleString("en-IN")}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              className="ghost-button admin-table-action"
                              type="button"
                              onClick={() => router.push(`/aria-admin-vault/users/${encodeURIComponent(user.id)}`)}
                              title="View full activity log"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              className="ghost-button admin-table-action"
                              type="button"
                              disabled={loading || user.isCurrentAdmin}
                              onClick={() => setEditingUser(user)}
                              title="Edit plan and credits"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className={`ghost-button admin-table-action ${
                                user.isActive ? "is-danger-action" : "is-success-action"
                              }`}
                              type="button"
                              disabled={loading || user.isCurrentAdmin}
                              onClick={() => void toggleUserStatus(user)}
                              title={user.isActive ? "Deactivate" : "Activate"}
                            >
                              {user.isCurrentAdmin ? (
                                <ShieldCheck size={14} />
                              ) : user.isActive ? (
                                <UserX size={14} />
                              ) : (
                                <UserCheck size={14} />
                              )}
                            </button>
                            <button
                              className="ghost-button admin-table-action is-danger-action"
                              type="button"
                              disabled={loading || user.isCurrentAdmin}
                              onClick={() => void deleteUser(user)}
                              title="Delete user"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* ---- Admins & access ---- */}
          <motion.section
            id="admin-members"
            className="admin-panel admin-panel-wide admin-accent-gold"
            aria-labelledby="admin-members-heading"
            variants={scrollItemVariants}
          >
            <div className="admin-panel-heading">
              <span className="admin-panel-icon">
                <ShieldCheck size={17} />
              </span>
              <div>
                <p className="eyebrow">Access control</p>
                <h3 id="admin-members-heading">Admins &amp; sub-admins</h3>
              </div>
            </div>

            {isSuperAdmin ? (
              <form className="admin-member-add" onSubmit={(event) => void addSubAdmin(event)}>
                <input
                  className="admin-input"
                  type="email"
                  placeholder="new-subadmin@email.com"
                  value={newAdminEmail}
                  onChange={(event) => setNewAdminEmail(event.target.value)}
                  aria-label="New sub-admin email"
                />
                <button className="primary-button" type="submit" disabled={adminBusy}>
                  <UserPlus size={15} />
                  {adminBusy ? "Working..." : "Add sub-admin"}
                </button>
              </form>
            ) : (
              <p className="admin-members-note">Only the primary admin can add or remove admins.</p>
            )}

            <div className="admin-member-list">
              {admins.map((member) => (
                <div className="admin-member-row" key={member.email}>
                  <div>
                    <strong>
                      {member.email}
                      {member.isCurrentUser ? " (you)" : ""}
                    </strong>
                    <span>{member.addedBy ? `Added by ${member.addedBy}` : "Primary allowlist (env)"}</span>
                  </div>
                  <span className={`admin-role-pill ${member.isSuperAdmin ? "is-super" : "is-sub"}`}>
                    {member.isSuperAdmin ? "Primary" : "Sub-admin"}
                  </span>
                  {isSuperAdmin && !member.isSuperAdmin ? (
                    <button
                      className="ghost-button admin-table-action is-danger-action"
                      type="button"
                      disabled={adminBusy}
                      onClick={() => void removeSubAdmin(member.email)}
                      title="Remove sub-admin"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span className="admin-member-spacer" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </motion.section>

          {/* ---- Billing catalog editor ---- */}
          <motion.section
            id="admin-billing"
            className="admin-panel admin-panel-wide admin-accent-green"
            aria-labelledby="admin-billing-heading"
            variants={scrollItemVariants}
          >
            <div className="admin-panel-heading">
              <span className="admin-panel-icon">
                <Wallet size={17} />
              </span>
              <div>
                <p className="eyebrow">Credits</p>
                <h3 id="admin-billing-heading">Billing catalog editor</h3>
              </div>
              <div className="admin-model-balance-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void saveBilling()}
                  disabled={billingSaving}
                >
                  <Save size={15} />
                  {billingSaving ? "Saving..." : "Save catalog"}
                </button>
              </div>
            </div>

            <div className="admin-editor-grid">
              {billingDraft.plans.map((plan) => (
                <div className="admin-editor-card" key={plan.id} style={{ borderColor: plan.accent }}>
                  <div className="admin-editor-card-head">
                    <span style={{ background: plan.accent }} />
                    <strong>{plan.name}</strong>
                  </div>
                  <label>
                    Price (INR)
                    <input
                      className="admin-input"
                      type="number"
                      min={0}
                      value={plan.priceInr}
                      onChange={(event) => updatePlanField(setBillingDraft, plan.id, "priceInr", Number(event.target.value))}
                    />
                  </label>
                  <label>
                    Monthly credits
                    <input
                      className="admin-input"
                      type="number"
                      min={0}
                      value={plan.monthlyCredits}
                      onChange={(event) =>
                        updatePlanField(setBillingDraft, plan.id, "monthlyCredits", Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    Note
                    <input
                      className="admin-input"
                      type="text"
                      value={plan.note}
                      onChange={(event) => updatePlanField(setBillingDraft, plan.id, "note", event.target.value)}
                    />
                  </label>
                </div>
              ))}
            </div>

            <div className="admin-mini-grid">
              <div className="admin-mini-panel">
                <div className="admin-mini-heading">
                  <CreditCard size={15} />
                  Top-up packs
                </div>
                <div className="admin-inline-edit admin-inline-head" aria-hidden="true">
                  <span>Pack</span>
                  <span>Price (₹)</span>
                  <span>Credits</span>
                </div>
                {billingDraft.topUps.map((pack) => (
                  <div className="admin-inline-edit" key={pack.id}>
                    <span>{pack.name}</span>
                    <input
                      className="admin-input admin-input-sm"
                      type="number"
                      min={0}
                      value={pack.priceInr}
                      onChange={(event) => updateTopUpField(setBillingDraft, pack.id, "priceInr", Number(event.target.value))}
                      aria-label={`${pack.name} price`}
                    />
                    <input
                      className="admin-input admin-input-sm"
                      type="number"
                      min={0}
                      value={pack.credits}
                      onChange={(event) => updateTopUpField(setBillingDraft, pack.id, "credits", Number(event.target.value))}
                      aria-label={`${pack.name} credits`}
                    />
                  </div>
                ))}
              </div>
              <div className="admin-mini-panel">
                <div className="admin-mini-heading">
                  <Activity size={15} />
                  Feature rates
                </div>
                <div className="admin-inline-edit admin-inline-head" aria-hidden="true">
                  <span>Feature</span>
                  <span>Credits</span>
                </div>
                {billingDraft.featureRates.map((rate) => (
                  <div className="admin-inline-edit" key={rate.id}>
                    <span>{rate.label}</span>
                    <input
                      className="admin-input admin-input-sm"
                      type="text"
                      value={rate.credits}
                      onChange={(event) => updateRateField(setBillingDraft, rate.id, event.target.value)}
                      aria-label={`${rate.label} credit rate`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* ---- Live model balances ---- */}
          <motion.section
            id="admin-model-balances"
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
                  {modelBalances ? `Updated ${formatModelBalanceTime(modelBalances.generatedAt)}` : "Waiting for provider data"}
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
              {modelBalanceError ? <div className="billing-model-empty">{modelBalanceError}</div> : null}
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
                        <th>Spent</th>
                        <th>Balance / Remaining</th>
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
                            <span className={`billing-status-pill is-${row.liveStatus}`}>{row.liveStatusLabel}</span>
                            {row.enabled ? null : <small>Disabled route</small>}
                          </td>
                          <td>{formatUsdPerMillion(row.inputUsdPerMillion)}</td>
                          <td>{formatUsdPerMillion(row.outputUsdPerMillion)}</td>
                          <td>{formatUsd(row.spentUsd)}</td>
                          <td>
                            <strong>{formatUsd(row.remainingUsd)}</strong>
                            {row.balanceSource ? (
                              <small className="admin-balance-live">{row.balanceSource}</small>
                            ) : row.remainingUsd !== null ? (
                              <small className="admin-balance-basis">budget − spend</small>
                            ) : null}
                          </td>
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

          {/* ---- Providers + budgets ---- */}
          <motion.section
            id="admin-providers"
            className="admin-panel admin-panel-wide admin-accent-red"
            aria-labelledby="admin-providers-heading"
            variants={scrollItemVariants}
          >
            <div className="admin-panel-heading">
              <span className="admin-panel-icon">
                <KeyRound size={17} />
              </span>
              <div>
                <p className="eyebrow">Providers</p>
                <h3 id="admin-providers-heading">API status and budgets</h3>
              </div>
              <div className="admin-model-balance-actions">
                <button className="primary-button" type="button" onClick={() => void saveBudgets()} disabled={budgetsSaving}>
                  <Save size={15} />
                  {budgetsSaving ? "Saving..." : "Save budgets"}
                </button>
              </div>
            </div>
            <div className="admin-provider-grid">
              {overview.providers.map((provider) => {
                const budget = budgets[provider.id];
                const enabled = budget?.enabled ?? true;

                const patchBudget = (changes: Partial<ProviderBudgets[string]>) =>
                  setBudgets((current) => {
                    const existing = current[provider.id] ?? { enabled: true, budgetUsd: null, balanceUsd: null };
                    return { ...current, [provider.id]: { ...existing, ...changes } };
                  });
                const toUsd = (value: string) => (value === "" ? null : Number(value));

                return (
                  <div className="admin-provider-card" key={provider.id}>
                    <div className="admin-provider-top">
                      <div>
                        <strong>{provider.label}</strong>
                        <span>{provider.modelCount} configured models</span>
                      </div>
                      <span className={`admin-status-pill ${provider.apiKeyConfigured ? "is-ready" : "is-missing"}`}>
                        {provider.apiKeyConfigured ? "Key ready" : "No key"}
                      </span>
                    </div>
                    <div className="admin-provider-controls">
                      <label className="admin-budget-field">
                        <Coins size={14} />
                        <input
                          className="admin-input admin-input-sm"
                          type="number"
                          min={0}
                          placeholder="No cap"
                          value={budget?.budgetUsd ?? ""}
                          onChange={(event) => patchBudget({ budgetUsd: toUsd(event.target.value) })}
                          aria-label={`${provider.label} budget USD`}
                        />
                        <em>budget</em>
                      </label>
                      <AdminSwitch checked={enabled} onChange={(value) => patchBudget({ enabled: value })} />
                    </div>
                    <label className="admin-budget-field admin-balance-field">
                      <Wallet size={14} />
                      <input
                        className="admin-input admin-input-sm"
                        type="number"
                        min={0}
                        placeholder="Auto / live"
                        value={budget?.balanceUsd ?? ""}
                        onChange={(event) => patchBudget({ balanceUsd: toUsd(event.target.value) })}
                        aria-label={`${provider.label} manual balance USD`}
                      />
                      <em>real balance</em>
                    </label>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/* ---- Routing display ---- */}
          <motion.section
            id="admin-routing"
            className="admin-panel"
            aria-labelledby="admin-routing-heading"
            variants={scrollItemVariants}
          >
            <div className="admin-panel-heading">
              <span className="admin-panel-icon">
                <Route size={17} />
              </span>
              <div>
                <p className="eyebrow">Routing</p>
                <h3 id="admin-routing-heading">Model routes</h3>
              </div>
              <button className="ghost-button" type="button" onClick={() => setRoutingOpen(true)}>
                <Settings2 size={14} />
                Edit
              </button>
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

          {/* ---- Configuration ---- */}
          <motion.section
            id="admin-config"
            className="admin-panel"
            aria-labelledby="admin-config-heading"
            variants={scrollItemVariants}
          >
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
        </motion.div>
      </section>

      {editingUser ? (
        <EditUserModal
          user={editingUser}
          planOptions={overview.billing.plans.map((plan) => plan.id)}
          busy={loading}
          onClose={() => setEditingUser(null)}
          onSave={(changes) => void saveUserBilling(editingUser, changes)}
        />
      ) : null}

      <ModelRoutingDrawer open={routingOpen} initialTab="aion" onOpenChange={setRoutingOpen} />
    </AppFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function EditUserModal({
  user,
  planOptions,
  busy,
  onClose,
  onSave
}: {
  user: AdminUserRecord;
  planOptions: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (changes: { planId: string; credits: number; role: string }) => void;
}) {
  const [planId, setPlanId] = useState(user.planId);
  const [credits, setCredits] = useState(user.credits);
  const [role, setRole] = useState(user.role);

  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Edit ${user.email}`}>
      <motion.div
        className="admin-modal"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="admin-modal-head">
          <div>
            <p className="eyebrow">Edit account</p>
            <h3>{user.name}</h3>
            <span>{user.email}</span>
          </div>
        </div>
        <div className="admin-modal-body">
          <label>
            Plan
            <select className="admin-input" value={planId} onChange={(event) => setPlanId(event.target.value)}>
              {planOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Credits
            <div className="admin-credit-stepper">
              <button type="button" onClick={() => setCredits((value) => Math.max(0, value - 100))}>
                -100
              </button>
              <input
                className="admin-input"
                type="number"
                min={0}
                value={credits}
                onChange={(event) => setCredits(Math.max(0, Number(event.target.value)))}
              />
              <button type="button" onClick={() => setCredits((value) => value + 100)}>
                +100
              </button>
            </div>
          </label>
          <label>
            Role
            <select className="admin-input" value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="member">member</option>
              <option value="staff">staff</option>
              <option value="admin">admin</option>
            </select>
          </label>
        </div>
        <div className="admin-modal-actions">
          <button className="ghost-button" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => onSave({ planId, credits, role })}
            disabled={busy}
          >
            <Save size={15} />
            Save changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AdminStat({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone?: "gold" | "red" | "green" | "blue";
}) {
  return (
    <motion.article
      className={`admin-stat-card ${tone ? `admin-accent-${tone}` : ""}`}
      variants={scrollItemVariants}
      whileHover={hoverLift}
    >
      <span className="admin-panel-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </motion.article>
  );
}

function AdminToggleRow({
  icon,
  label,
  detail,
  checked,
  onChange,
  tone
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  tone?: "danger";
}) {
  return (
    <div className={`admin-flag-row ${tone === "danger" ? "is-danger" : ""}`}>
      <span className="admin-flag-icon">{icon}</span>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <AdminSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

function AdminSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`admin-switch ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Billing draft helpers                                                      */
/* -------------------------------------------------------------------------- */

type BillingDraft = AdminOverview["billing"];

function updatePlanField(
  setDraft: React.Dispatch<React.SetStateAction<BillingDraft>>,
  id: string,
  field: "priceInr" | "monthlyCredits" | "note",
  value: number | string
) {
  setDraft((draft) => ({
    ...draft,
    plans: draft.plans.map((plan) => (plan.id === id ? { ...plan, [field]: value } : plan))
  }));
}

function updateTopUpField(
  setDraft: React.Dispatch<React.SetStateAction<BillingDraft>>,
  id: string,
  field: "priceInr" | "credits",
  value: number
) {
  setDraft((draft) => ({
    ...draft,
    topUps: draft.topUps.map((pack) => (pack.id === id ? { ...pack, [field]: value } : pack))
  }));
}

function updateRateField(
  setDraft: React.Dispatch<React.SetStateAction<BillingDraft>>,
  id: string,
  value: string
) {
  setDraft((draft) => ({
    ...draft,
    featureRates: draft.featureRates.map((rate) => (rate.id === id ? { ...rate, credits: value } : rate))
  }));
}

/* -------------------------------------------------------------------------- */
/* Formatters                                                                 */
/* -------------------------------------------------------------------------- */

function formatStat(value: number | null) {
  return value === null ? "-" : value.toLocaleString("en-IN");
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
