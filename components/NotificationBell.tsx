"use client";

import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { AlertCircle, AlertTriangle, Bell, BellOff, CheckCircle2, Info, type LucideIcon } from "lucide-react";

type AnnouncementTone = "info" | "success" | "warning" | "danger";
type Announcement = { tone: AnnouncementTone; message: string };

const SEEN_KEY = "aion:announcement-seen";

const TONE_META: Record<AnnouncementTone, { title: string; icon: LucideIcon }> = {
  info: { title: "Announcement", icon: Info },
  success: { title: "Good news", icon: CheckCircle2 },
  warning: { title: "Heads up", icon: AlertTriangle },
  danger: { title: "Important", icon: AlertCircle }
};

/**
 * Broadcast notification bell. Shows the admin's active announcement to everyone
 * (public + signed-in), with an unread dot until it's opened. Renders nothing
 * until the announcement is fetched, then stays as a bell icon.
 */
export function NotificationBell({ className }: { className?: string }) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [unread, setUnread] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch("/api/announcement", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { announcement: Announcement | null } | null) => {
          if (cancelled) return;
          const next = data?.announcement ?? null;
          setAnnouncement(next);
          if (next) {
            try {
              setUnread(localStorage.getItem(SEEN_KEY) !== next.message);
            } catch {
              setUnread(true);
            }
          } else {
            setUnread(false);
          }
        })
        .catch(() => undefined);
    };

    load();
    // Pick up newly-saved broadcasts without a manual reload.
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(load, 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, []);

  const markSeen = () => {
    if (!announcement) return;
    try {
      localStorage.setItem(SEEN_KEY, announcement.message);
    } catch {
      /* ignore */
    }
    setUnread(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) markSeen();
      }}
    >
      <Popover.Trigger asChild>
        <button className={`notif-bell ${className ?? ""}`} type="button" aria-label="Notifications">
          <Bell size={18} />
          {unread ? <span className="notif-dot" aria-hidden="true" /> : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="notif-popover" sideOffset={10} align="end" collisionPadding={12}>
          <div className="notif-popover-head">Notifications</div>
          {announcement ? (
            (() => {
              const meta = TONE_META[announcement.tone] ?? TONE_META.info;
              const Icon = meta.icon;
              return (
                <div className={`notif-item is-${announcement.tone}`}>
                  <span className="notif-item-icon">
                    <Icon size={17} />
                  </span>
                  <div className="notif-item-body">
                    <strong>{meta.title}</strong>
                    <p>{announcement.message}</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="notif-empty">
              <BellOff size={20} />
              <strong>You&apos;re all caught up</strong>
              <span>No new announcements right now.</span>
            </div>
          )}
          <Popover.Arrow className="notif-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
