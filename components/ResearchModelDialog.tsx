"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import {
  AION_RESEARCH_MODELS,
  getAionResearchModelLabel,
  type AionResearchModelId
} from "@/types/aion";

type ResearchModelDialogProps = {
  open: boolean;
  selectedModel: AionResearchModelId;
  canSubmit: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onModelChange: (model: AionResearchModelId) => void;
  onUseModel: () => void;
  onRunResearch: () => void;
};

export function ResearchModelDialog({
  open,
  selectedModel,
  canSubmit,
  disabled,
  onOpenChange,
  onModelChange,
  onUseModel,
  onRunResearch
}: ResearchModelDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-card is-compact">
          <div className="dialog-heading">
            <div>
              <Dialog.Title className="dialog-title">Aria Research</Dialog.Title>
              <Dialog.Description className="dialog-description">
                Select one engine for this research task.
              </Dialog.Description>
            </div>
            <Dialog.Close className="dialog-close" aria-label="Close">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="dialog-form">
            <label className="field-label">
              Research engine
              <select
                className="field-input"
                value={selectedModel}
                onChange={(event) => onModelChange(event.target.value as AionResearchModelId)}
              >
                {AION_RESEARCH_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {getAionResearchModelLabel(model)}
                  </option>
                ))}
              </select>
            </label>

            <div className="research-model-grid" aria-label="Research model shortcuts">
              {AION_RESEARCH_MODELS.map((model) => (
                <button
                  key={model}
                  className={`research-model-option ${selectedModel === model ? "is-active" : ""}`}
                  type="button"
                  onClick={() => onModelChange(model)}
                >
                  <Search size={14} />
                  <span>{getAionResearchModelLabel(model)}</span>
                </button>
              ))}
            </div>

            <div className="dialog-actions">
              <Dialog.Close className="ghost-button" type="button">
                Cancel
              </Dialog.Close>
              <button className="ghost-button" type="button" onClick={onUseModel}>
                Use model
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={onRunResearch}
                disabled={!canSubmit || disabled}
              >
                Start research
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
