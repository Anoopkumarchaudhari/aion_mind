"use client";

import { useEffect, useRef } from "react";

export function useAutoScroll(dependency: unknown) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    requestAnimationFrame(() => {
      element.scrollTo({
        top: element.scrollHeight,
        behavior: "smooth"
      });
    });
  }, [dependency]);

  return ref;
}
