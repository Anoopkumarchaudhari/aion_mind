"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { standardTransition } from "@/lib/motion";

type AppMotionProviderProps = {
  children: ReactNode;
};

export function AppMotionProvider({ children }: AppMotionProviderProps) {
  return (
    <MotionConfig reducedMotion="user" transition={standardTransition}>
      {children}
    </MotionConfig>
  );
}
