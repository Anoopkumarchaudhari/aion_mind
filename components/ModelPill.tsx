"use client";

import clsx from "clsx";
import { SlidersHorizontal } from "lucide-react";
import type { AionModelId } from "@/types/aion";

type ModelPillProps = {
  active: AionModelId;
  onChange: (model: AionModelId) => void;
  onResearchClick?: () => void;
  onOpenRouting?: () => void;
};

const TIERS: Array<{ id: AionModelId; label: string }> = [
  { id: "aion-mind", label: "Aria Mind" },
  { id: "aion-mind-pro", label: "Aria Research" },
  { id: "aion-mind-analyzer", label: "Aria Analyzer" }
];

export function ModelPill({ active, onChange, onResearchClick, onOpenRouting }: ModelPillProps) {
  return (
    <div className="model-pill-shell">
      <div className="model-pill" aria-label="Aria Mind model selector">
        {TIERS.map((tier) => (
          <button
            key={tier.id}
            className={clsx("model-pill-button", active === tier.id && "is-active")}
            type="button"
            onClick={() => {
              onChange(tier.id);

              if (tier.id === "aion-mind-pro") {
                onResearchClick?.();
              }
            }}
          >
            {tier.label}
          </button>
        ))}
      </div>
      {onOpenRouting ? (
        <button
          className="model-routing-trigger"
          type="button"
          aria-label="Open model routing"
          title="Model routing"
          onClick={onOpenRouting}
        >
          <SlidersHorizontal size={15} />
        </button>
      ) : null}
    </div>
  );
}
