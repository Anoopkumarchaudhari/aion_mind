"use client";

import { useEffect } from "react";

/**
 * Browsers (and Next.js) restore the previous scroll position on refresh.
 * This disables that behavior and forces the page to the top on every load.
 */
export function ScrollToTopOnLoad() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  return null;
}
