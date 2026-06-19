import type { Metadata } from "next";
import { AppMotionProvider } from "@/components/AppMotionProvider";
import { ModeProvider } from "@/components/ModeProvider";
import { ScrollToTopOnLoad } from "@/components/ScrollToTopOnLoad";
import { ThemeWatcher } from "@/components/ThemeWatcher";
import "./globals.css";

// Runs before first paint so the correct theme is applied with no flash.
const themeBootstrap = `(() => {
  try {
    var pref = "system";
    var raw = localStorage.getItem("aion-theme");
    if (raw) { var p = JSON.parse(raw); if (p && p.state && p.state.preference) pref = p.state.preference; }
    var sys = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    var resolved = pref === "system" ? sys : pref;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    var prefs = localStorage.getItem("aion-mind-prefs");
    if (prefs && JSON.parse(prefs).reduceMotion) document.documentElement.dataset.reduceMotion = "true";
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();`;

export const metadata: Metadata = {
  title: "Aria Mind",
  description: "Aria Mind AI dashboard",
  icons: {
    icon: [
      {
        url: "/Aria%20logo/aria-icon.png",
        type: "image/png"
      }
    ],
    shortcut: "/Aria%20logo/aria-icon.png",
    apple: "/Aria%20logo/aria-icon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ScrollToTopOnLoad />
        <ThemeWatcher />
        <AppMotionProvider>
          <ModeProvider>{children}</ModeProvider>
        </AppMotionProvider>
      </body>
    </html>
  );
}
