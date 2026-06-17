"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Save,
  ServerCog,
  X
} from "lucide-react";
import {
  AION_ROUTING_PROVIDERS,
  getAionRoutingProviderLabel,
  type AionProviderStatus,
  type AionRouteSlot,
  type AionRoutingPayload,
  type AionRoutingProvider,
  type AionRoutingSettings
} from "@/types/aionRouting";

type RoutingTab = "aion" | "diverse" | "pro" | "analyzer";
type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

type ModelRoutingDrawerProps = {
  open: boolean;
  initialTab: RoutingTab;
  onOpenChange: (open: boolean) => void;
};

const ROUTING_TABS: Array<{ id: RoutingTab; label: string }> = [
  { id: "aion", label: "Aria Instant" },
  { id: "diverse", label: "Aria Diverse" },
  { id: "pro", label: "Aria Research" },
  { id: "analyzer", label: "Aria Mind / Analyzer" }
];

export function ModelRoutingDrawer({
  open,
  initialTab,
  onOpenChange
}: ModelRoutingDrawerProps) {
  const [activeTab, setActiveTab] = useState<RoutingTab>(initialTab);
  const [payload, setPayload] = useState<AionRoutingPayload | null>(null);
  const [draft, setDraft] = useState<AionRoutingSettings | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveTab(initialTab);
    void loadRouting();
  }, [initialTab, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  const activeRouteLabel = useMemo(
    () => ROUTING_TABS.find((tab) => tab.id === activeTab)?.label ?? "Aria Instant",
    [activeTab]
  );

  if (!open) {
    return null;
  }

  async function loadRouting() {
    setSaveState("loading");
    setMessage("");

    try {
      const response = await fetch("/api/model-routing", { cache: "no-store" });
      const nextPayload = (await response.json()) as AionRoutingPayload & { error?: string };

      if (!response.ok) {
        throw new Error(nextPayload.error || "Could not load model routing.");
      }

      setPayload(nextPayload);
      setDraft(cloneSettings(nextPayload.settings));
      setSaveState("idle");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load model routing.");
      setSaveState("error");
    }
  }

  async function saveRouting() {
    if (!draft) {
      return;
    }

    setSaveState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/model-routing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: draft })
      });
      const nextPayload = (await response.json()) as AionRoutingPayload & { error?: string };

      if (!response.ok) {
        throw new Error(nextPayload.error || "Could not save model routing.");
      }

      setPayload(nextPayload);
      setDraft(cloneSettings(nextPayload.settings));
      setSaveState("saved");
      setMessage("Saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save model routing.");
      setSaveState("error");
    }
  }

  function restoreDefaults() {
    if (!payload) {
      return;
    }

    setDraft(cloneSettings(payload.defaults));
    setSaveState("idle");
    setMessage("");
  }

  function updatePrimary(patch: Partial<AionRouteSlot>) {
    setDraft((settings) =>
      settings
        ? {
            ...settings,
            aion: {
              primary: { ...settings.aion.primary, ...patch }
            }
          }
        : settings
    );
  }

  function updateCandidate(route: "pro" | "analyzer", index: number, patch: Partial<AionRouteSlot>) {
    setDraft((settings) => {
      if (!settings) {
        return settings;
      }

      return {
        ...settings,
        [route]: {
          ...settings[route],
          candidates: settings[route].candidates.map((slot, slotIndex) =>
            slotIndex === index ? { ...slot, ...patch } : slot
          )
        }
      };
    });
  }

  function updateJudge(route: "pro" | "analyzer", patch: Partial<AionRouteSlot>) {
    setDraft((settings) =>
      settings
        ? {
            ...settings,
            [route]: {
              ...settings[route],
              judge: { ...settings[route].judge, ...patch }
            }
          }
        : settings
    );
  }

  function updateDiverse(index: number, patch: Partial<AionRouteSlot>) {
    setDraft((settings) =>
      settings
        ? {
            ...settings,
            diverse: settings.diverse.map((slot, slotIndex) =>
              slotIndex === index ? { ...slot, ...patch } : slot
            )
          }
        : settings
    );
  }

  return (
    <div className="routing-drawer-root">
      <button
        className="routing-drawer-backdrop"
        type="button"
        aria-label="Close model routing"
        onClick={() => onOpenChange(false)}
      />
      <aside className="routing-drawer" role="dialog" aria-modal="true" aria-label="Model routing">
        <header className="routing-drawer-header">
          <div className="routing-title-group">
            <span className="routing-title-icon">
              <ServerCog size={18} />
            </span>
            <div>
              <p className="eyebrow">Routing</p>
              <h2>Model routing</h2>
            </div>
          </div>
          <button
            className="routing-icon-button"
            type="button"
            aria-label="Close"
            title="Close"
            onClick={() => onOpenChange(false)}
          >
            <X size={18} />
          </button>
        </header>

        {payload ? (
          <>
            <ProviderStatusGrid providers={payload.providerStatus} />

            <div className="routing-tabs" aria-label="Routing mode">
              {ROUTING_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={tab.id === activeTab ? "is-active" : ""}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <section className="routing-section" aria-label={`${activeRouteLabel} route`}>
              {draft ? (
                <RoutePanel
                  activeTab={activeTab}
                  settings={draft}
                  providers={payload.providerStatus}
                  instantModelChoices={payload.instantModelChoices}
                  onUpdatePrimary={updatePrimary}
                  onUpdateCandidate={updateCandidate}
                  onUpdateJudge={updateJudge}
                  onUpdateDiverse={updateDiverse}
                />
              ) : null}
            </section>

            <footer className="routing-drawer-footer">
              <div className={`routing-save-state is-${saveState}`}>
                {saveState === "error" ? <AlertTriangle size={15} /> : null}
                {saveState === "saved" ? <CheckCircle2 size={15} /> : null}
                <span>{message}</span>
              </div>
              <button className="ghost-button routing-action-button" type="button" onClick={restoreDefaults}>
                <RotateCcw size={15} />
                Defaults
              </button>
              <button
                className="primary-button routing-action-button"
                type="button"
                onClick={() => void saveRouting()}
                disabled={saveState === "saving" || saveState === "loading"}
              >
                <Save size={15} />
                Save
              </button>
            </footer>
          </>
        ) : (
          <div className="routing-loading-panel">
            {saveState === "error" ? <AlertTriangle size={18} /> : <ServerCog size={18} />}
            <span>{message || "Loading"}</span>
          </div>
        )}
      </aside>
    </div>
  );
}

function ProviderStatusGrid({ providers }: { providers: AionProviderStatus[] }) {
  return (
    <div className="routing-provider-grid">
      {providers.map((provider) => (
        <div className="routing-provider-status" key={provider.id}>
          <span
            className={`routing-status-dot ${provider.apiKeyConfigured ? "is-ready" : "is-missing"}`}
          />
          <span>{provider.label}</span>
        </div>
      ))}
    </div>
  );
}

function RoutePanel({
  activeTab,
  settings,
  providers,
  instantModelChoices,
  onUpdatePrimary,
  onUpdateCandidate,
  onUpdateJudge,
  onUpdateDiverse
}: {
  activeTab: RoutingTab;
  settings: AionRoutingSettings;
  providers: AionProviderStatus[];
  instantModelChoices: Array<{ label: string; value: string }>;
  onUpdatePrimary: (patch: Partial<AionRouteSlot>) => void;
  onUpdateCandidate: (
    route: "pro" | "analyzer",
    index: number,
    patch: Partial<AionRouteSlot>
  ) => void;
  onUpdateJudge: (route: "pro" | "analyzer", patch: Partial<AionRouteSlot>) => void;
  onUpdateDiverse: (index: number, patch: Partial<AionRouteSlot>) => void;
}) {
  if (activeTab === "aion") {
    return (
      <div className="routing-slot-stack">
        <div className="routing-group-title">Aria Instant model</div>
        <SlotEditor
          slot={settings.aion.primary}
          providers={providers}
          lockProvider
          modelChoices={instantModelChoices}
          onChange={onUpdatePrimary}
        />
      </div>
    );
  }

  if (activeTab === "diverse") {
    return (
      <div className="routing-slot-stack">
        <div className="routing-group-title">Model per provider</div>
        {settings.diverse.map((slot, index) => (
          <SlotEditor
            key={slot.id}
            slot={slot}
            providers={providers}
            lockProvider
            onChange={(patch) => onUpdateDiverse(index, patch)}
          />
        ))}
      </div>
    );
  }

  const route = settings[activeTab];

  return (
    <div className="routing-slot-stack">
      <div className="routing-group-title">
        {activeTab === "pro" ? "Models compared side by side" : "Models combined by the judge"}
      </div>
      {route.candidates.map((slot, index) => (
        <SlotEditor
          key={slot.id}
          slot={slot}
          providers={providers}
          lockProvider
          onChange={(patch) => onUpdateCandidate(activeTab, index, patch)}
        />
      ))}

      {activeTab === "analyzer" ? (
        <>
          <div className="routing-group-title">Judge / router (picks &amp; combines)</div>
          <SlotEditor
            slot={route.judge}
            providers={providers}
            lockProvider
            onChange={(patch) => onUpdateJudge(activeTab, patch)}
          />
        </>
      ) : null}
    </div>
  );
}

function SlotEditor({
  slot,
  providers,
  lockProvider = false,
  modelChoices,
  onChange
}: {
  slot: AionRouteSlot;
  providers: AionProviderStatus[];
  lockProvider?: boolean;
  modelChoices?: Array<{ label: string; value: string }>;
  onChange: (patch: Partial<AionRouteSlot>) => void;
}) {
  const modelListId = `models-${slot.id}`;
  const datalistModels = modelChoices ?? getProviderDefaults(providers, slot.provider);

  function handleProviderChange(provider: AionRoutingProvider) {
    onChange({
      provider,
      model: getFirstDefaultModel(providers, provider)
    });
  }

  return (
    <article className={`routing-slot ${slot.enabled ? "" : "is-disabled"}`}>
      <label className="routing-slot-heading">
        <input
          type="checkbox"
          checked={slot.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
        />
        <span>{slot.label}</span>
      </label>

      <div className="routing-slot-grid">
        <label className="field-label">
          Provider
          {lockProvider ? (
            <span className="field-input is-static">{getAionRoutingProviderLabel(slot.provider)}</span>
          ) : (
            <select
              className="field-input"
              value={slot.provider}
              onChange={(event) => handleProviderChange(event.target.value as AionRoutingProvider)}
            >
              {AION_ROUTING_PROVIDERS.map((provider) => (
                <option value={provider} key={provider}>
                  {getAionRoutingProviderLabel(provider)}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="field-label">
          Model ID
          <input
            className="field-input"
            list={modelListId}
            value={slot.model}
            onChange={(event) => onChange({ model: event.target.value })}
            placeholder="Use server default"
          />
          <datalist id={modelListId}>
            {datalistModels.map((model) => (
              <option key={`${slot.id}-${model.label}`} value={model.value}>
                {model.label}
              </option>
            ))}
          </datalist>
        </label>

        <label className="field-label">
          Temp
          <input
            className="field-input"
            type="number"
            min={0}
            max={2}
            step={0.05}
            value={slot.temperature}
            onChange={(event) => onChange({ temperature: Number(event.target.value) })}
          />
        </label>
      </div>
    </article>
  );
}

function getProviderDefaults(providers: AionProviderStatus[], provider: AionRoutingProvider) {
  return (
    providers
      .find((item) => item.id === provider)
      ?.defaultModels.filter((model) => model.value) ?? []
  );
}

function getFirstDefaultModel(providers: AionProviderStatus[], provider: AionRoutingProvider) {
  return getProviderDefaults(providers, provider)[0]?.value ?? "";
}

function cloneSettings(settings: AionRoutingSettings): AionRoutingSettings {
  return JSON.parse(JSON.stringify(settings)) as AionRoutingSettings;
}
