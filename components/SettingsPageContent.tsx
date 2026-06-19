"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Keyboard, Search, Trash2 } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { SettingsSidebar, type SettingsTab } from "@/components/SettingsSidebar";
import { ThemePreferenceControl } from "@/components/ThemeToggle";
import { BillingPageContent } from "@/components/BillingPageContent";
import { UserDashboard } from "@/components/UserDashboard";
import type { ResolvedBillingCatalog } from "@/services/billingCatalog";

const TABS: SettingsTab[] = [
  "profile",
  "appearance",
  "notifications",
  "privacy",
  "help",
  "billing",
  "dashboard"
];
const WORKSPACE_STORAGE_KEY = "aion-mind-workspace";
const PREFS_STORAGE_KEY = "aion-mind-prefs";

type Prefs = {
  reduceMotion: boolean;
  compactMode: boolean;
  notifyProduct: boolean;
  notifySecurity: boolean;
  notifyUsage: boolean;
  ephemeralDefault: boolean;
};

const DEFAULT_PREFS: Prefs = {
  reduceMotion: false,
  compactMode: false,
  notifyProduct: true,
  notifySecurity: true,
  notifyUsage: false,
  ephemeralDefault: false
};

export function SettingsPageContent({ catalog }: { catalog: ResolvedBillingCatalog }) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    TABS.includes(initialTab as SettingsTab) ? (initialTab as SettingsTab) : "profile"
  );
  const [account, setAccount] = useState({ name: "", email: "" });

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { name?: string; email?: string } } | null) => {
        if (data?.user) {
          setAccount({ name: data.user.name ?? "", email: data.user.email ?? "" });
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <AppFrame
      title={getTabLabel(activeTab)}
      sidebar={(props) => (
        <SettingsSidebar
          {...props}
          active={activeTab}
          onSelect={setActiveTab}
          name={account.name}
          email={account.email}
        />
      )}
    >
      {activeTab === "billing" ? (
        <BillingPageContent catalog={catalog} />
      ) : activeTab === "dashboard" ? (
        <UserDashboard />
      ) : (
        <section className="route-content settings-route">
          <div className="settings-route-inner">
            <header className="settings-route-head">
              <p className="eyebrow">Settings</p>
              <h2>{getTabLabel(activeTab)}</h2>
              <p className="muted-copy">{getTabBlurb(activeTab)}</p>
            </header>

            {activeTab === "profile" ? <ProfilePanel /> : null}
            {activeTab === "appearance" ? <AppearancePanel /> : null}
            {activeTab === "notifications" ? <NotificationsPanel /> : null}
            {activeTab === "privacy" ? <PrivacyPanel /> : null}
            {activeTab === "help" ? <HelpPanel /> : null}
          </div>
        </section>
      )}
    </AppFrame>
  );
}

/* ----------------------------- Prefs helpers ----------------------------- */

function loadPrefs(): Prefs {
  if (typeof window === "undefined") {
    return DEFAULT_PREFS;
  }
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    const loaded = loadPrefs();
    setPrefs(loaded);
    document.documentElement.dataset.reduceMotion = loaded.reduceMotion ? "true" : "false";
  }, []);

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((current) => {
      const next = { ...current, [key]: value };
      try {
        window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      // Reduce-motion is applied globally via a data attribute.
      if (key === "reduceMotion") {
        document.documentElement.dataset.reduceMotion = value ? "true" : "false";
      }
      return next;
    });
  }

  return { prefs, update };
}

/* ------------------------------- Switch UI ------------------------------- */

function Toggle({
  checked,
  onChange,
  title,
  description
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        className={`settings-switch ${checked ? "is-on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

/* ------------------------------- Panels ---------------------------------- */

function ProfilePanel() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState("Aria workspace");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const storedWorkspace = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (storedWorkspace) {
      setWorkspace(storedWorkspace);
    }

    void fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { name?: string; email?: string } } | null) => {
        if (data?.user) {
          setName(data.user.name ?? "");
          setEmail(data.user.email ?? "");
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  async function handleSave() {
    if (saving) {
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Display name must be at least 2 characters.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not save your profile.");
      }

      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.trim());
      window.dispatchEvent(new Event("aion:profile-updated"));
      toast.success("Profile saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-card">
      <div className="settings-profile-head">
        <span className="settings-avatar-initials" aria-hidden="true">
          {getInitials(name)}
        </span>
        <div>
          <strong>{name || "Your name"}</strong>
          <span className="muted-copy">{email || "Signed-in account"}</span>
        </div>
      </div>

      <label className="field-label">
        Display name
        <input
          className="field-input"
          value={name}
          maxLength={80}
          placeholder="Your name"
          disabled={!loaded}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="field-label">
        Workspace
        <input
          className="field-input"
          value={workspace}
          maxLength={60}
          placeholder="Workspace name"
          onChange={(event) => setWorkspace(event.target.value)}
        />
      </label>
      <button className="primary-button" type="button" onClick={() => void handleSave()} disabled={saving || !loaded}>
        {saving ? "Saving..." : "Save profile"}
      </button>
    </div>
  );
}

function AppearancePanel() {
  const { prefs, update } = usePrefs();

  return (
    <div className="settings-card">
      <div className="setting-field">
        <span className="field-label">Color theme</span>
        <p className="muted-copy">Choose a light or dark appearance, or follow your system setting.</p>
        <ThemePreferenceControl />
      </div>
      <Toggle
        title="Reduce motion"
        description="Minimise animations and transitions across the app."
        checked={prefs.reduceMotion}
        onChange={(value) => update("reduceMotion", value)}
      />
      <Toggle
        title="Compact layout"
        description="Tighten spacing to fit more on screen."
        checked={prefs.compactMode}
        onChange={(value) => update("compactMode", value)}
      />
    </div>
  );
}

function NotificationsPanel() {
  const { prefs, update } = usePrefs();

  return (
    <div className="settings-card">
      <Toggle
        title="Product updates"
        description="New models, features, and improvements."
        checked={prefs.notifyProduct}
        onChange={(value) => update("notifyProduct", value)}
      />
      <Toggle
        title="Security alerts"
        description="Sign-ins from new devices and account changes."
        checked={prefs.notifySecurity}
        onChange={(value) => update("notifySecurity", value)}
      />
      <Toggle
        title="Usage summaries"
        description="A periodic recap of your credit usage."
        checked={prefs.notifyUsage}
        onChange={(value) => update("notifyUsage", value)}
      />
    </div>
  );
}

function PrivacyPanel() {
  const { prefs, update } = usePrefs();

  return (
    <div className="settings-card">
      <Toggle
        title="Temporary chats by default"
        description="Start new chats in temporary mode so they aren't saved."
        checked={prefs.ephemeralDefault}
        onChange={(value) => update("ephemeralDefault", value)}
      />
      <div className="setting-field">
        <span className="field-label">Local data</span>
        <p className="muted-copy">
          Clear cached chats, library items, notebooks, and video jobs from this browser. Your account and credits are
          kept safely on the server.
        </p>
        <button
          className="danger-button"
          type="button"
          onClick={() => {
            if (window.confirm("Clear local Aria Mind data in this browser?")) {
              Object.keys(window.localStorage)
                .filter((key) => key.startsWith("aion-mind"))
                .forEach((key) => window.localStorage.removeItem(key));
              window.location.href = "/";
            }
          }}
        >
          <Trash2 size={15} />
          Clear local data
        </button>
      </div>
    </div>
  );
}

function HelpPanel() {
  return (
    <div className="settings-card">
      <div className="setting-field">
        <span className="field-label">Getting around</span>
        <p className="muted-copy">
          Start chats from the sidebar, search with Cmd/Ctrl+K, organise work into notebooks, and save useful outputs to
          the Library.
        </p>
        <div className="settings-help-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => window.dispatchEvent(new Event("aion:show-shortcuts"))}
          >
            <Keyboard size={15} />
            Keyboard shortcuts
          </button>
          <button className="ghost-button" type="button" onClick={() => window.dispatchEvent(new Event("aion:open-search"))}>
            <Search size={15} />
            Open search
          </button>
        </div>
      </div>
      <div className="setting-field">
        <span className="field-label">Billing & credits</span>
        <p className="muted-copy">Manage plans, top-ups, invoices, and usage from the billing dashboard.</p>
        <Link className="ghost-button" href="/settings?tab=billing">
          Open billing
        </Link>
      </div>
    </div>
  );
}

function getTabLabel(tab: SettingsTab) {
  switch (tab) {
    case "privacy":
      return "Data & Privacy";
    default:
      return tab[0].toUpperCase() + tab.slice(1);
  }
}

function getTabBlurb(tab: SettingsTab) {
  switch (tab) {
    case "profile":
      return "Your display name and workspace.";
    case "appearance":
      return "Theme, motion, and layout density.";
    case "notifications":
      return "Choose what we email you about.";
    case "privacy":
      return "Control local data and chat retention.";
    default:
      return "Tips, shortcuts, and where to find things.";
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}
