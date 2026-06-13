"use client";

import clsx from "clsx";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Database,
  Home,
  KeyRound,
  Route,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet
} from "lucide-react";
import { AionLogo } from "@/components/AionLogo";
import type { AppFrameSidebarProps } from "@/components/AppFrame";
import { gentleSpring, sidebarBackdropVariants } from "@/lib/motion";
import type { AdminOverview } from "@/services/adminOverview";
import type { ProviderModelBalancesPayload } from "@/services/providerModelBalances";

type AdminSidebarProps = AppFrameSidebarProps & {
  overview: AdminOverview;
  modelBalances: ProviderModelBalancesPayload | null;
};

export function AdminSidebar({
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapsed,
  overview,
  modelBalances
}: AdminSidebarProps) {
  const activeUsers = overview.stats.activeUsers ?? overview.users.filter((user) => user.isActive).length;
  const liveModels = modelBalances?.rows.filter((row) => row.liveStatus === "available").length ?? null;
  const readyProviders = overview.providers.filter((provider) => provider.apiKeyConfigured).length;

  return (
    <>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.button
            className="sidebar-backdrop"
            type="button"
            aria-label="Close admin sidebar"
            variants={sidebarBackdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
          />
        ) : null}
      </AnimatePresence>

      <motion.aside
        className={clsx("sidebar context-sidebar admin-context-sidebar", isOpen && "is-open", isCollapsed && "is-collapsed")}
        aria-label="Admin navigation"
        layout="size"
        transition={gentleSpring}
      >
        <div className="brand-row">
          <AionLogo size={28} />
          <div className="brand-copy">
            <p className="brand-name">Admin</p>
            <p className="brand-status">Private control</p>
          </div>
          <button
            className="square-icon"
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
            title={isCollapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="context-sidebar-body">
          <section className="context-sidebar-summary">
            <p className="eyebrow">Signed in admin</p>
            <strong>{overview.admin.name}</strong>
            <span>{overview.admin.email}</span>
          </section>

          <div className="context-sidebar-metric-grid">
            <div>
              <span>Users</span>
              <strong>{formatStat(overview.stats.users)}</strong>
            </div>
            <div>
              <span>Active users</span>
              <strong>{formatStat(activeUsers)}</strong>
            </div>
            <div>
              <span>Sessions</span>
              <strong>{formatStat(overview.stats.activeSessions)}</strong>
            </div>
            <div>
              <span>Plans</span>
              <strong>{overview.billing.plans.length.toLocaleString("en-IN")}</strong>
            </div>
          </div>

          <nav className="context-sidebar-nav" aria-label="Admin sections">
            <div className="sidebar-section-label">Control</div>
            <a className="sidebar-action" href="#admin-overview" onClick={onClose}>
              <ShieldCheck size={17} />
              <span className="sidebar-action-label">Overview</span>
            </a>
            <a className="sidebar-action" href="#admin-model-balances" onClick={onClose}>
              <KeyRound size={17} />
              <span className="sidebar-action-label">Model balances</span>
            </a>
            <a className="sidebar-action" href="#admin-users" onClick={onClose}>
              <Users size={17} />
              <span className="sidebar-action-label">Users</span>
            </a>
            <a className="sidebar-action" href="#admin-providers" onClick={onClose}>
              <UserCheck size={17} />
              <span className="sidebar-action-label">Providers</span>
            </a>
            <a className="sidebar-action" href="#admin-routing" onClick={onClose}>
              <Route size={17} />
              <span className="sidebar-action-label">Routing</span>
            </a>
            <a className="sidebar-action" href="#admin-config" onClick={onClose}>
              <Database size={17} />
              <span className="sidebar-action-label">Configuration</span>
            </a>
            <a className="sidebar-action" href="#admin-billing" onClick={onClose}>
              <Wallet size={17} />
              <span className="sidebar-action-label">Credit catalog</span>
            </a>
          </nav>

          <section className="context-sidebar-card">
            <span>Provider APIs</span>
            <strong>
              {readyProviders}/{overview.providers.length} ready
            </strong>
            <small>{liveModels === null ? "Waiting for live model data" : `${liveModels} live models`}</small>
          </section>

          <section className="context-sidebar-card">
            <span>Activity</span>
            <strong>{formatStat(overview.stats.chatThreads)} chats</strong>
            <small>{formatStat(overview.stats.chatMessages)} messages</small>
          </section>

          <Link className="sidebar-action context-sidebar-footer" href="/" onClick={onClose}>
            <Home size={17} />
            <span className="sidebar-action-label">Back to chat</span>
          </Link>
        </div>
      </motion.aside>
    </>
  );
}

function formatStat(value: number | null) {
  return value === null ? "-" : value.toLocaleString("en-IN");
}
