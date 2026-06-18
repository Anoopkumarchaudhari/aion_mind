"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AppFrame } from "@/components/AppFrame";
import { ThemePreferenceControl } from "@/components/ThemeToggle";
import { DEFAULT_AVATAR_ID, PROFILE_AVATARS, getProfileAvatar } from "@/lib/avatars";

const tabs = ["profile", "appearance", "privacy", "billing", "help"] as const;
type SettingsTab = (typeof tabs)[number];

const WORKSPACE_STORAGE_KEY = "aion-mind-workspace";

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
    return <ProfilePanel />;
  }

  if (tab === "appearance") {
    return (
      <div className="settings-card">
        <div className="setting-field">
          <span className="field-label">Color theme</span>
          <p className="muted-copy">Choose a light or dark appearance, or follow your system setting.</p>
          <ThemePreferenceControl />
        </div>
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
            if (window.confirm("Clear local Aria Mind data in this browser?")) {
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
        <h3>Aria Mind</h3>
        <p className="muted-copy">Credit wallet, plans, top-ups, invoices, and usage are managed in Billing.</p>
        <Link className="ghost-button" href="/billing">Open billing dashboard</Link>
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

function ProfilePanel() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState("Aria workspace");
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const storedWorkspace = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (storedWorkspace) {
      setWorkspace(storedWorkspace);
    }

    void fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { name?: string; email?: string; avatar?: string | null } } | null) => {
        if (data?.user) {
          setName(data.user.name ?? "");
          setEmail(data.user.email ?? "");
          if (data.user.avatar) {
            setAvatarId(data.user.avatar);
          }
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
        body: JSON.stringify({ name: name.trim(), avatar: avatarId })
      });
      const data = (await response.json()) as { error?: string; user?: { name?: string } };

      if (!response.ok) {
        throw new Error(data.error || "Could not save your profile.");
      }

      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.trim());
      // Let the rest of the app pick up the new name/avatar without a full reload.
      window.dispatchEvent(new Event("aion:profile-updated"));
      toast.success("Profile saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  const selectedAvatar = getProfileAvatar(avatarId);

  return (
    <div className="settings-card">
      <div className="settings-profile-head">
        <span
          className="settings-avatar-preview"
          style={{ background: selectedAvatar.gradient }}
          aria-hidden="true"
        >
          {selectedAvatar.emoji}
        </span>
        <div>
          <strong>{name || "Your name"}</strong>
          <span className="muted-copy">{email || "Signed-in account"}</span>
        </div>
      </div>

      <div className="field-label">
        Profile avatar
        <div className="settings-avatar-grid" role="radiogroup" aria-label="Choose an avatar">
          {PROFILE_AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              role="radio"
              aria-checked={avatar.id === avatarId}
              aria-label={avatar.label}
              title={avatar.label}
              className={`settings-avatar ${avatar.id === avatarId ? "is-active" : ""}`}
              style={{ background: avatar.gradient }}
              onClick={() => setAvatarId(avatar.id)}
            >
              {avatar.emoji}
            </button>
          ))}
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

function getTabLabel(tab: SettingsTab) {
  switch (tab) {
    case "privacy":
      return "Data & Privacy";
    default:
      return tab[0].toUpperCase() + tab.slice(1);
  }
}
