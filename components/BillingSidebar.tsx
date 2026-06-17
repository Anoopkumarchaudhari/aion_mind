"use client";

import clsx from "clsx";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Home,
  Plus,
  Receipt,
  Wallet
} from "lucide-react";
import { AionLogo } from "@/components/AionLogo";
import type { AppFrameSidebarProps } from "@/components/AppFrame";
import { gentleSpring, sidebarBackdropVariants } from "@/lib/motion";

type BillingSidebarProps = AppFrameSidebarProps & {
  planName: string;
  availableCredits: number;
  monthlyRemaining: number;
  topUpCredits: number;
  usedPercent: number;
  nextRenewalDate: string;
  autoTopUpEnabled: boolean;
};

export function BillingSidebar({
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapsed,
  planName,
  availableCredits,
  monthlyRemaining,
  topUpCredits,
  usedPercent,
  nextRenewalDate,
  autoTopUpEnabled
}: BillingSidebarProps) {
  return (
    <>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.button
            className="sidebar-backdrop"
            type="button"
            aria-label="Close billing sidebar"
            variants={sidebarBackdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
          />
        ) : null}
      </AnimatePresence>

      <motion.aside
        className={clsx("sidebar context-sidebar", isOpen && "is-open", isCollapsed && "is-collapsed")}
        aria-label="Billing navigation"
        layout="size"
        transition={gentleSpring}
      >
        <div className="brand-row">
          <AionLogo size={28} />
          <div className="brand-copy">
            <p className="brand-name">Billing</p>
            <p className="brand-status">Credit wallet</p>
          </div>
          <button
            className="square-icon"
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand billing sidebar" : "Collapse billing sidebar"}
            title={isCollapsed ? "Expand billing sidebar" : "Collapse billing sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="context-sidebar-body">
          <section className="context-sidebar-summary">
            <p className="eyebrow">Available balance</p>
            <strong>{availableCredits.toLocaleString("en-IN")}</strong>
            <span>credits ready</span>
            <div className="context-sidebar-progress" aria-label={`${usedPercent}% monthly credits used`}>
              <span style={{ width: `${usedPercent}%` }} />
            </div>
          </section>

          <div className="context-sidebar-metric-grid">
            <div>
              <span>Plan</span>
              <strong>{planName}</strong>
            </div>
            <div>
              <span>Monthly left</span>
              <strong>{monthlyRemaining.toLocaleString("en-IN")}</strong>
            </div>
            <div>
              <span>Top-up</span>
              <strong>{topUpCredits.toLocaleString("en-IN")}</strong>
            </div>
            <div>
              <span>Auto top-up</span>
              <strong>{autoTopUpEnabled ? "On" : "Off"}</strong>
            </div>
          </div>

          <nav className="context-sidebar-nav" aria-label="Billing sections">
            <div className="sidebar-section-label">Billing</div>
            <a className="sidebar-action" href="#billing-overview" onClick={onClose}>
              <Wallet size={17} />
              <span className="sidebar-action-label">Overview</span>
            </a>
            <a className="sidebar-action" href="#billing-plans" onClick={onClose}>
              <CreditCard size={17} />
              <span className="sidebar-action-label">Plans</span>
            </a>
            <a className="sidebar-action" href="#billing-topups" onClick={onClose}>
              <Plus size={17} />
              <span className="sidebar-action-label">Top-ups</span>
            </a>
            <a className="sidebar-action" href="#billing-usage" onClick={onClose}>
              <Activity size={17} />
              <span className="sidebar-action-label">Usage</span>
            </a>
            <a className="sidebar-action" href="#billing-ledger" onClick={onClose}>
              <Receipt size={17} />
              <span className="sidebar-action-label">Invoices</span>
            </a>
          </nav>

          <section className="context-sidebar-card">
            <span>Renewal</span>
            <strong>{nextRenewalDate}</strong>
          </section>

          <Link className="sidebar-action context-sidebar-footer" href="/chat" onClick={onClose}>
            <Home size={17} />
            <span className="sidebar-action-label">Back to chat</span>
          </Link>
        </div>
      </motion.aside>
    </>
  );
}
