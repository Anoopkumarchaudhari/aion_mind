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
  diverseProvider: AriaDiverseProvider;
  onChange: (model: AionModelId) => void;
  onDiverseProviderChange: (provider: AriaDiverseProvider) => void;
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

export function ModelPill({
  active,
  diverseProvider,
  onChange,
  onDiverseProviderChange,
  onOpenRouting
}: ModelPillProps) {
  const [open, setOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setSubmenuOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setSubmenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const triggerLabel =
    active === "aria-diverse"
      ? `${getAionModelLabel("aria-diverse")} · ${getAriaDiverseProviderLabel(diverseProvider)}`
      : getAionModelLabel(active);

  function selectMode(model: AionModelId) {
    onChange(model);
    setOpen(false);
    setSubmenuOpen(false);
  }

  function selectProvider(provider: AriaDiverseProvider) {
    onDiverseProviderChange(provider);
    onChange("aria-diverse");
    setOpen(false);
    setSubmenuOpen(false);
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
              if (model === "aria-diverse") {
                return (
                  <div
                    key={model}
                    className="model-menu-item has-submenu"
                    onMouseEnter={() => setSubmenuOpen(true)}
                    onMouseLeave={() => setSubmenuOpen(false)}
                  >
                    <button
                      type="button"
                      className={clsx("model-menu-item-main", active === model && "is-active")}
                      onClick={() => setSubmenuOpen((value) => !value)}
                    >
                      <span className="model-menu-item-text">
                        <span className="model-menu-item-label">
                          {getAionModelLabel(model)}
                          {active === model ? ` · ${getAriaDiverseProviderLabel(diverseProvider)}` : ""}
                        </span>
                        <span className="model-menu-item-tagline">{getAionModelTagline(model)}</span>
                      </span>
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>

                    {submenuOpen ? (
                      <div className="model-submenu" role="menu">
                        {ARIA_DIVERSE_PROVIDERS.map((provider) => (
                          <button
                            key={provider}
                            type="button"
                            className={clsx(
                              "model-submenu-item",
                              active === model && diverseProvider === provider && "is-active"
                            )}
                            onClick={() => selectProvider(provider)}
                          >
                            <span>{getAriaDiverseProviderLabel(provider)}</span>
                            {active === model && diverseProvider === provider ? (
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
