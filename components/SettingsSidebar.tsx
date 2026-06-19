"use client";

import clsx from "clsx";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Palette,
  Shield,
  User
} from "lucide-react";
import { AionLogo } from "@/components/AionLogo";
import type { AppFrameSidebarProps } from "@/components/AppFrame";
import { gentleSpring, sidebarBackdropVariants } from "@/lib/motion";

export type SettingsTab =
  | "profile"
  | "appearance"
  | "notifications"
  | "privacy"
  | "help"
  | "billing"
  | "dashboard";

const NAV: Array<{ id: SettingsTab; label: string; icon: typeof User }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Data & Privacy", icon: Shield },
  { id: "help", label: "Help", icon: LifeBuoy }
];

type Props = AppFrameSidebarProps & {
  active: SettingsTab;
  onSelect: (tab: SettingsTab) => void;
  name: string;
  email: string;
};

export function SettingsSidebar({
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapsed,
  active,
  onSelect,
  name,
  email
}: Props) {
  return (
    <>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.button
            className="sidebar-backdrop"
            type="button"
            aria-label="Close settings sidebar"
            variants={sidebarBackdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
          />
        ) : null}
      </AnimatePresence>

      <motion.aside
        className={clsx("sidebar context-sidebar settings-sidebar", isOpen && "is-open", isCollapsed && "is-collapsed")}
        aria-label="Settings navigation"
        layout="size"
        transition={gentleSpring}
      >
        <div className="brand-row">
          <AionLogo size={28} />
          <div className="brand-copy">
            <p className="brand-name">Settings</p>
            <p className="brand-status">Manage your account</p>
          </div>
          <button
            className="square-icon"
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="context-sidebar-body">
          <section className="context-sidebar-summary">
            <span className="settings-side-avatar" aria-hidden="true">
              {getInitials(name)}
            </span>
            <strong>{name || "Member"}</strong>
            <span>{email || "Signed-in account"}</span>
          </section>

          <nav className="context-sidebar-nav" aria-label="Settings sections">
            <div className="sidebar-section-label">Settings</div>
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={clsx("sidebar-action", active === item.id && "is-active")}
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <Icon size={17} />
                  <span className="sidebar-action-label">{item.label}</span>
                </button>
              );
            })}

            <div className="sidebar-section-label">Account</div>
            <button
              type="button"
              className={clsx("sidebar-action", active === "billing" && "is-active")}
              onClick={() => {
                onSelect("billing");
                onClose();
              }}
            >
              <CreditCard size={17} />
              <span className="sidebar-action-label">Billing</span>
            </button>
            <button
              type="button"
              className={clsx("sidebar-action", active === "dashboard" && "is-active")}
              onClick={() => {
                onSelect("dashboard");
                onClose();
              }}
            >
              <LayoutDashboard size={17} />
              <span className="sidebar-action-label">Dashboard</span>
            </button>
          </nav>

          <Link className="sidebar-action context-sidebar-footer" href="/chat" onClick={onClose}>
            <Home size={17} />
            <span className="sidebar-action-label">Back to chat</span>
          </Link>
        </div>
      </motion.aside>
    </>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}
