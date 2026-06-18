"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, ChevronRight, SlidersHorizontal, Sparkles } from "lucide-react";
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
  const [openSubmenu, setOpenSubmenu] = useState<AionModelId | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setOpenSubmenu(null);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setOpenSubmenu(null);
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

  function selectMode(model: AionModelId) {
    onChange(model);
    setOpen(false);
    setOpenSubmenu(null);
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
    onChange("aion-mind-pro");
    setOpen(false);
    setOpenSubmenu(null);
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
            {MODES.map((model) => {
              // Aria Diverse — checkbox multi-select (1–5 providers).
              if (model === "aria-diverse") {
                return (
                  <div
                    key={model}
                    className="model-menu-item has-submenu"
                    onMouseEnter={() => setOpenSubmenu(model)}
                    onMouseLeave={() => setOpenSubmenu((value) => (value === model ? null : value))}
                  >
                    <button
                      type="button"
                      className={clsx("model-menu-item-main", active === model && "is-active")}
                      onClick={() => setOpenSubmenu((value) => (value === model ? null : model))}
                    >
                      <span className="model-menu-item-text">
                        <span className="model-menu-item-label">
                          {getAionModelLabel(model)}
                          {active === model ? ` · ${describeDiverseCount(diverseProviders)}` : ""}
                        </span>
                        <span className="model-menu-item-tagline">{getAionModelTagline(model)}</span>
                      </span>
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>

                    {openSubmenu === model ? (
                      <div className="model-submenu" role="menu">
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
                              onClick={() => toggleDiverseProvider(provider)}
                            >
                              <span className={clsx("model-submenu-check", checked && "is-checked")}>
                                {checked ? <Check size={12} aria-hidden="true" /> : null}
                              </span>
                              <span>{getAriaDiverseProviderLabel(provider)}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              // Aria Research — single-select provider.
              if (model === "aion-mind-pro") {
                return (
                  <div
                    key={model}
                    className="model-menu-item has-submenu"
                    onMouseEnter={() => setOpenSubmenu(model)}
                    onMouseLeave={() => setOpenSubmenu((value) => (value === model ? null : value))}
                  >
                    <button
                      type="button"
                      className={clsx("model-menu-item-main", active === model && "is-active")}
                      onClick={() => setOpenSubmenu((value) => (value === model ? null : model))}
                    >
                      <span className="model-menu-item-text">
                        <span className="model-menu-item-label">
                          {getAionModelLabel(model)}
                          {active === model ? ` · ${getAriaDiverseProviderLabel(researchProvider)}` : ""}
                        </span>
                        <span className="model-menu-item-tagline">{getAionModelTagline(model)}</span>
                      </span>
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>

                    {openSubmenu === model ? (
                      <div className="model-submenu" role="menu">
                        <p className="model-submenu-hint">Choose one model for a deep-dive answer</p>
                        {ARIA_DIVERSE_PROVIDERS.map((provider) => (
                          <button
                            key={provider}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active === model && researchProvider === provider}
                            className={clsx(
                              "model-submenu-item",
                              active === model && researchProvider === provider && "is-active"
                            )}
                            onClick={() => selectResearchProvider(provider)}
                          >
                            <span>{getAriaDiverseProviderLabel(provider)}</span>
                            {active === model && researchProvider === provider ? (
                              <Check size={14} aria-hidden="true" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }

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
                  onClick={() => selectMode(model)}
                >
                  <span className="model-menu-item-text">
                    <span className="model-menu-item-label">
                      {getAionModelLabel(model)}
                      {model === RECOMMENDED_MODE ? (
                        <span className="model-menu-rec">Recommended</span>
                      ) : null}
                    </span>
                    <span className="model-menu-item-tagline">{getAionModelTagline(model)}</span>
                  </span>
                  {active === model ? <Check size={16} aria-hidden="true" /> : null}
                </button>
              );
            })}
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
