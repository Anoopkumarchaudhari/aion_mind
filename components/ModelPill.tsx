"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import {
  ARIA_DIVERSE_PROVIDERS,
  getAionModelLabel,
  getAionModelTagline,
  getAriaDiverseProviderLabel,
  type AionModelId,
  type AriaDiverseProvider
} from "@/types/aion";

type ModelPillProps = {
  active: AionModelId;
  diverseProviders: AriaDiverseProvider[];
  researchProvider: AriaDiverseProvider;
  onChange: (model: AionModelId) => void;
  onDiverseProvidersChange: (providers: AriaDiverseProvider[]) => void;
  onResearchProviderChange: (provider: AriaDiverseProvider) => void;
  onOpenRouting?: () => void;
};

// Menu order: simple entry point first, hero "Aria Mind" last and highlighted.
const MODES: AionModelId[] = [
  "aria-instant",
  "aion-mind-pro",
  "aria-diverse",
  "aion-mind-analyzer",
  "aion-mind"
];

const RECOMMENDED_MODE: AionModelId = "aion-mind";
const MAX_DIVERSE_PROVIDERS = 5;

// Modes that drill into an inline sub-options view instead of selecting directly.
function hasSubOptions(model: AionModelId) {
  return model === "aion-mind-pro" || model === "aria-diverse";
}

export function ModelPill({
  active,
  diverseProviders,
  researchProvider,
  onChange,
  onDiverseProvidersChange,
  onResearchProviderChange,
  onOpenRouting
}: ModelPillProps) {
  const [open, setOpen] = useState(false);
  // null = root list view; a mode id = inline detail view for that mode.
  const [detailMode, setDetailMode] = useState<AionModelId | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setDetailMode(null);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // Escape steps back out of a detail view first, then closes the menu.
        setDetailMode((current) => {
          if (current) {
            return null;
          }
          setOpen(false);
          return null;
        });
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const triggerLabel = getTriggerLabel(active, diverseProviders, researchProvider);

  function closeMenu() {
    setOpen(false);
    setDetailMode(null);
  }

  function selectMode(model: AionModelId) {
    onChange(model);
    closeMenu();
  }

  // Root row click: drill into sub-options if available, otherwise select.
  function handleRowClick(model: AionModelId) {
    if (hasSubOptions(model)) {
      setDetailMode(model);
    } else {
      selectMode(model);
    }
  }

  // Aria Diverse: toggle a provider in the multi-select (keep at least one).
  function toggleDiverseProvider(provider: AriaDiverseProvider) {
    const isSelected = diverseProviders.includes(provider);

    if (isSelected) {
      if (diverseProviders.length <= 1) {
        return; // never drop below one provider
      }

      onDiverseProvidersChange(diverseProviders.filter((item) => item !== provider));
    } else {
      if (diverseProviders.length >= MAX_DIVERSE_PROVIDERS) {
        return;
      }

      // Preserve the canonical provider order.
      const next = ARIA_DIVERSE_PROVIDERS.filter(
        (item) => item === provider || diverseProviders.includes(item)
      );
      onDiverseProvidersChange(next);
    }

    onChange("aria-diverse");
  }

  // Aria Research: pick exactly one provider.
  function selectResearchProvider(provider: AriaDiverseProvider) {
    onResearchProviderChange(provider);
    selectMode("aion-mind-pro");
  }

  return (
    <div className="model-pill-shell">
      <div className="model-menu" ref={ref}>
        <button
          className="model-menu-trigger"
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Sparkles size={14} aria-hidden="true" />
          <span className="model-menu-trigger-label">{triggerLabel}</span>
          <ChevronDown size={15} aria-hidden="true" className={clsx("model-menu-chevron", open && "is-open")} />
        </button>

        {open ? (
          <div className="model-menu-panel" role="menu">
            {detailMode ? (
              <ModelDetailView
                mode={detailMode}
                active={active}
                diverseProviders={diverseProviders}
                researchProvider={researchProvider}
                onBack={() => setDetailMode(null)}
                onToggleDiverseProvider={toggleDiverseProvider}
                onSelectResearchProvider={selectResearchProvider}
                onSelectMode={selectMode}
              />
            ) : (
              MODES.map((model) => {
                const drillable = hasSubOptions(model);
                const subtitleSuffix =
                  active === model && model === "aria-diverse"
                    ? ` · ${describeDiverseCount(diverseProviders)}`
                    : active === model && model === "aion-mind-pro"
                      ? ` · ${getAriaDiverseProviderLabel(researchProvider)}`
                      : "";

                return (
                  <button
                    key={model}
                    type="button"
                    role="menuitem"
                    className={clsx(
                      "model-menu-item-main model-menu-item",
                      active === model && "is-active",
                      model === RECOMMENDED_MODE && "is-recommended"
                    )}
                    onClick={() => handleRowClick(model)}
                  >
                    <span className="model-menu-item-text">
                      <span className="model-menu-item-label">
                        {getAionModelLabel(model)}
                        {subtitleSuffix}
                        {model === RECOMMENDED_MODE ? (
                          <span className="model-menu-rec">Recommended</span>
                        ) : null}
                      </span>
                      <span className="model-menu-item-tagline">{getAionModelTagline(model)}</span>
                    </span>
                    {drillable ? (
                      <ChevronRight size={15} aria-hidden="true" />
                    ) : active === model ? (
                      <Check size={16} aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        ) : null}
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

function ModelDetailView({
  mode,
  active,
  diverseProviders,
  researchProvider,
  onBack,
  onToggleDiverseProvider,
  onSelectResearchProvider,
  onSelectMode
}: {
  mode: AionModelId;
  active: AionModelId;
  diverseProviders: AriaDiverseProvider[];
  researchProvider: AriaDiverseProvider;
  onBack: () => void;
  onToggleDiverseProvider: (provider: AriaDiverseProvider) => void;
  onSelectResearchProvider: (provider: AriaDiverseProvider) => void;
  onSelectMode: (model: AionModelId) => void;
}) {
  return (
    <div className="model-menu-detail">
      <div className="model-menu-detail-head">
        <button
          type="button"
          className="model-menu-back"
          aria-label="Back to all models"
          title="Back"
          onClick={onBack}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="model-menu-detail-text">
          <span className="model-menu-item-label">{getAionModelLabel(mode)}</span>
          <span className="model-menu-item-tagline">{getAionModelTagline(mode)}</span>
        </span>
      </div>

      <div className="model-menu-detail-body">
        {mode === "aria-diverse" ? (
          <>
            <p className="model-submenu-hint">Pick 1–5 models to compare side by side</p>
            {ARIA_DIVERSE_PROVIDERS.map((provider) => {
              const checked = diverseProviders.includes(provider);
              const atLimit = !checked && diverseProviders.length >= MAX_DIVERSE_PROVIDERS;

              return (
                <button
                  key={provider}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  disabled={atLimit}
                  className={clsx("model-submenu-item is-checkbox", checked && "is-active")}
                  onClick={() => onToggleDiverseProvider(provider)}
                >
                  <span className={clsx("model-submenu-check", checked && "is-checked")}>
                    {checked ? <Check size={12} aria-hidden="true" /> : null}
                  </span>
                  <span>{getAriaDiverseProviderLabel(provider)}</span>
                </button>
              );
            })}
          </>
        ) : mode === "aion-mind-pro" ? (
          <>
            <p className="model-submenu-hint">Choose one model for a deep-dive answer</p>
            {ARIA_DIVERSE_PROVIDERS.map((provider) => {
              const selected = active === mode && researchProvider === provider;

              return (
                <button
                  key={provider}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={clsx("model-submenu-item", selected && "is-active")}
                  onClick={() => onSelectResearchProvider(provider)}
                >
                  <span>{getAriaDiverseProviderLabel(provider)}</span>
                  {selected ? <Check size={14} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </>
        ) : (
          <button
            type="button"
            className={clsx("model-submenu-item model-menu-use", active === mode && "is-active")}
            onClick={() => onSelectMode(mode)}
          >
            <span>{active === mode ? "Currently selected" : "Use this model"}</span>
            {active === mode ? <Check size={14} aria-hidden="true" /> : null}
          </button>
        )}
      </div>
    </div>
  );
}

function getTriggerLabel(
  active: AionModelId,
  diverseProviders: AriaDiverseProvider[],
  researchProvider: AriaDiverseProvider
) {
  if (active === "aria-diverse") {
    return `${getAionModelLabel("aria-diverse")} · ${describeDiverseCount(diverseProviders)}`;
  }

  if (active === "aion-mind-pro") {
    return `${getAionModelLabel("aion-mind-pro")} · ${getAriaDiverseProviderLabel(researchProvider)}`;
  }

  return getAionModelLabel(active);
}

function describeDiverseCount(providers: AriaDiverseProvider[]) {
  if (providers.length === 1) {
    return getAriaDiverseProviderLabel(providers[0]);
  }

  return `${providers.length} models`;
}
