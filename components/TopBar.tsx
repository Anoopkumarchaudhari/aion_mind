"use client";

import Link from "next/link";
import { CreditCard, Edit3, Menu } from "lucide-react";
import { TempModeToggle } from "@/components/TempModeToggle";
import { getAvailableCredits, useBillingStore } from "@/store/useBillingStore";

type TopBarProps = {
  tempMode: boolean;
  onToggleTempMode: () => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
};

export function TopBar({ tempMode, onToggleTempMode, onNewChat, onToggleSidebar }: TopBarProps) {
  const billing = useBillingStore();
  const availableCredits = getAvailableCredits(billing);

  return (
    <header className="topbar">
      <button
        className="mobile-menu"
        type="button"
        onClick={onToggleSidebar}
        aria-label="Open sidebar"
        title="Open sidebar"
      >
        <Menu size={18} />
      </button>
      <div />
      <div className="topbar-actions">
        <Link className="top-billing-button" href="/billing" aria-label="Open billing dashboard" title="Billing">
          <CreditCard size={16} />
          <span className="top-billing-balance">{formatCompactCredits(availableCredits)}</span>
        </Link>
        <TempModeToggle active={tempMode} onToggle={onToggleTempMode} />
        <button
          className="top-edit-button"
          type="button"
          onClick={onNewChat}
          aria-label="Start new chat"
          title="New chat"
        >
          <Edit3 size={17} />
        </button>
      </div>
    </header>
  );
}

function formatCompactCredits(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }

  return String(value);
}
