"use client";

import clsx from "clsx";
import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore, type ThemePreference } from "@/store/useThemeStore";

/** Compact sun/moon button for the top bar — one click flips light/dark. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const resolved = useThemeStore((state) => state.resolved);
  const toggle = useThemeStore((state) => state.toggle);
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      className={clsx("theme-toggle-button", className)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
    >
      {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}

const PREFERENCE_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor }
];

/** Segmented Light / Dark / System control for the Settings page. */
export function ThemePreferenceControl() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <div className="theme-segmented" role="radiogroup" aria-label="Color theme">
      {PREFERENCE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={clsx("theme-segmented-option", active && "is-active")}
            onClick={() => setPreference(option.value)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
