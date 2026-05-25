"use client";

import clsx from "clsx";
import { Ghost } from "lucide-react";

type TempModeToggleProps = {
  active: boolean;
  onToggle: () => void;
};

export function TempModeToggle({ active, onToggle }: TempModeToggleProps) {
  return (
    <button
      className={clsx("temp-toggle", active && "is-active")}
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "Turn off temporary chat" : "Turn on temporary chat"}
      title={active ? "Temporary chat on" : "Temporary chat"}
    >
      <Ghost size={17} />
    </button>
  );
}
