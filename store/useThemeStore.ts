"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "aion-theme";

type ThemeState = {
  /** What the user picked. "system" follows the OS. */
  preference: ThemePreference;
  /** The concrete theme currently applied to the document. */
  resolved: ResolvedTheme;
  /** Whether the store has hydrated from storage (avoids a flash on mount). */
  hydrated: boolean;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
  syncSystem: () => void;
};

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

/** Write the resolved theme onto <html> so CSS [data-theme] rules apply. */
export function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      preference: "system",
      resolved: "dark",
      hydrated: false,

      setPreference(preference) {
        const resolved = resolveTheme(preference);
        applyTheme(resolved);
        set({ preference, resolved });
      },

      toggle() {
        // A manual toggle always lands on a concrete light/dark choice.
        const next: ResolvedTheme = get().resolved === "dark" ? "light" : "dark";
        applyTheme(next);
        set({ preference: next, resolved: next });
      },

      // Re-resolve when the OS theme changes (only meaningful for "system").
      syncSystem() {
        if (get().preference !== "system") {
          return;
        }

        const resolved = getSystemTheme();
        applyTheme(resolved);
        set({ resolved });
      }
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ preference: state.preference }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }

        const resolved = resolveTheme(state.preference);
        applyTheme(resolved);
        state.resolved = resolved;
        state.hydrated = true;
      }
    }
  )
);
