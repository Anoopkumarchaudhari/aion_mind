"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { GlobalOverlays } from "@/components/GlobalOverlays";
import { useChatStore } from "@/store/useChatStore";

type ModeProviderProps = {
  children: ReactNode;
};

export function ModeProvider({ children }: ModeProviderProps) {
  const tempMode = useChatStore((state) => state.tempMode);

  useEffect(() => {
    void useChatStore.getState().hydrate();
  }, []);

  return (
    <div className="mode-root" data-mode={tempMode ? "temp" : "default"}>
      {children}
      <GlobalOverlays />
    </div>
  );
}
