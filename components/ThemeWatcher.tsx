"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/store/useThemeStore";

/**
 * Keeps the applied theme in sync with the OS when the preference is "system".
 * Initial paint is handled by the inline bootstrap script in the root layout;
 * this only reacts to live OS changes.
 */
export function ThemeWatcher() {
  const syncSystem = useThemeStore((state) => state.syncSystem);

  useEffect(() => {
    // Re-apply once on mount in case the store rehydrated after first paint.
    syncSystem();

    if (!window.matchMedia) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => syncSystem();

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [syncSystem]);

  return null;
}
