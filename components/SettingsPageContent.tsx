"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";

const tabs = ["profile", "api-keys", "appearance", "privacy", "billing", "help"] as const;
type SettingsTab = (typeof tabs)[number];

export function SettingsPageContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabs.includes(initialTab as SettingsTab) ? (initialTab as SettingsTab) : "profile"
  );
  const tabLabel = useMemo(() => getTabLabel(activeTab), [activeTab]);

  return (
    <AppFrame title="Settings">
      <section className="settings-layout">
        <aside className="settings-tabs" aria-label="Settings sections">
          {tabs.map((tab) => (
            <button
              className={tab === activeTab ? "is-active" : ""}
              type="button"
              key={tab}
              onClick={() => setActiveTab(tab)}
            >
              {getTabLabel(tab)}
            </button>
          ))}
        </aside>
        <main className="settings-panel">
          <p className="eyebrow">Settings</p>
          <h2>{tabLabel}</h2>
          <SettingsPanel tab={activeTab} />
        </main>
      </section>
    </AppFrame>
  );
}

function SettingsPanel({ tab }: { tab: SettingsTab }) {
  if (tab === "profile") {
    return (
      <div className="settings-card">
        <label className="field-label">
          Display name
          <input className="field-input" defaultValue="Anoop Kumar" />
        </label>
        <label className="field-label">
          Workspace
          <input className="field-input" defaultValue="Aion workspace" />
        </label>
        <button className="primary-button" type="button">Save profile</button>
      </div>
    );
  }

  if (tab === "api-keys") {
    return (
      <div className="settings-card">
        {["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROK_API_KEY"].map((key) => (
          <label className="field-label" key={key}>
            {key}
            <input className="field-input" type="password" placeholder="Stored in .env on the server" readOnly />
          </label>
        ))}
        <p className="muted-copy">API keys stay server-side in `.env`; this page documents what the app expects.</p>
      </div>
    );
  }

  if (tab === "appearance") {
    return (
      <div className="settings-card">
        <label className="field-label">
          Accent theme
          <select className="field-input" defaultValue="emerald">
            <option value="emerald">Emerald / cyan</option>
            <option value="rose">Temporary chat rose</option>
          </select>
        </label>
        <label className="setting-toggle">
          <input type="checkbox" defaultChecked />
          Reduce motion when possible
        </label>
      </div>
    );
  }

  if (tab === "privacy") {
    return (
      <div className="settings-card">
        <p className="muted-copy">Clear local cached chats, library items, notebooks, and video jobs from this browser.</p>
        <button
          className="danger-button"
          type="button"
          onClick={() => {
            if (window.confirm("Clear local Aion Mind data in this browser?")) {
              Object.keys(window.localStorage)
                .filter((key) => key.startsWith("aion-mind"))
                .forEach((key) => window.localStorage.removeItem(key));
              window.location.href = "/";
            }
          }}
        >
          Clear local data
        </button>
      </div>
    );
  }

  if (tab === "billing") {
    return (
      <div className="settings-card">
        <h3>Aion Mind Pro</h3>
        <p className="muted-copy">Your workspace is currently on the Pro tier.</p>
        <button className="ghost-button" type="button">Download invoice summary</button>
      </div>
    );
  }

  return (
    <div className="settings-card">
      <h3>Help</h3>
      <p className="muted-copy">Use the sidebar to start chats, search with Cmd/Ctrl+K, organize work into notebooks, and save useful outputs to the Library.</p>
      <button className="ghost-button" type="button" onClick={() => window.dispatchEvent(new Event("aion:show-shortcuts"))}>
        View keyboard shortcuts
      </button>
    </div>
  );
}

function getTabLabel(tab: SettingsTab) {
  switch (tab) {
    case "api-keys":
      return "API Keys";
    case "privacy":
      return "Data & Privacy";
    default:
      return tab[0].toUpperCase() + tab.slice(1);
  }
}
