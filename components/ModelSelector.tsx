"use client";

import { Menu, Sparkles, Trash2 } from "lucide-react";
import type { AionModelId } from "@/types/aion";

type ModelOption = {
  id: AionModelId;
  label: string;
};

const MODEL_OPTIONS: ModelOption[] = [
  { id: "aion-mind", label: "Aion Mind" },
  { id: "aion-mind-pro", label: "Aion Mind Pro" },
  { id: "aion-mind-analyzer", label: "Aion Mind Analyser" }
];

type ModelSelectorProps = {
  selectedModel: AionModelId;
  clearDisabled: boolean;
  onModelChange: (model: AionModelId) => void;
  onToggleSidebar: () => void;
  onClearChat: () => void;
};

export function ModelSelector({
  selectedModel,
  clearDisabled,
  onModelChange,
  onToggleSidebar,
  onClearChat
}: ModelSelectorProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="mobile-menu"
          type="button"
          onClick={onToggleSidebar}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Menu size={18} />
        </button>
      </div>

      <div className="model-selector-wrap" aria-label="Aion Mind model selector">
        <div className="segmented-control">
          {MODEL_OPTIONS.map((model) => (
            <button
              key={model.id}
              className={`model-segment ${selectedModel === model.id ? "is-active" : ""}`}
              type="button"
              onClick={() => onModelChange(model.id)}
              title={model.label}
            >
              <Sparkles size={12} />
              <span className="model-label">{model.label}</span>
            </button>
          ))}
        </div>

        <div className="model-dropdown-wrap">
          <select
            className="model-dropdown"
            value={selectedModel}
            onChange={(event) => onModelChange(event.target.value as AionModelId)}
            aria-label="Select Aion Mind model"
          >
            {MODEL_OPTIONS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        className="clear-button"
        type="button"
        onClick={onClearChat}
        disabled={clearDisabled}
        aria-label="Clear chat"
        title="Clear chat"
      >
        <Trash2 size={16} />
      </button>
    </header>
  );
}
