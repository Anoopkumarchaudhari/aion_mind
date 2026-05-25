"use client";

import { Edit3, Menu } from "lucide-react";
import { TempModeToggle } from "@/components/TempModeToggle";

type TopBarProps = {
  tempMode: boolean;
  onToggleTempMode: () => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
};

export function TopBar({ tempMode, onToggleTempMode, onNewChat, onToggleSidebar }: TopBarProps) {
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
