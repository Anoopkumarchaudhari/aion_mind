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

const SITE_URL = "https://ariamindx.com";

// Every spelling/spacing people might type when looking for the brand.
// These power both the meta keywords and the JSON-LD alternateName signal.
const BRAND_ALIASES = [
  "AriaMindX",
  "Aria Mind X",
  "AriaMind X",
  "Aria MindX",
  "Aria Min X",
  "Aria Mind",
  "ariamindx",
  "ariamindx.com"
];

// Official AriaMindX profiles. `sameAs` is the strongest signal Google uses to
// recognise the brand as a distinct entity (and stop confusing it with others).
// Paste the real URLs here as each profile goes live, then rebuild + redeploy.
const BRAND_PROFILES: string[] = [
  // "https://www.linkedin.com/company/ariamindx",
  // "https://x.com/ariamindx",
  // "https://www.instagram.com/ariamindx",
  // "https://www.producthunt.com/products/ariamindx",
  // "https://www.youtube.com/@ariamindx"
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AriaMindX — Aria Mind X AI Assistant",
    template: "%s | AriaMindX"
  },
  description:
    "AriaMindX (Aria Mind X) is an all-in-one AI assistant for chat, search, images, video, notebooks, translation and podcasts. Also known as AriaMind X, Aria MindX or Aria Mind.",
  applicationName: "AriaMindX",
  keywords: BRAND_ALIASES.concat([
    "AI assistant",
    "AI chat",
    "AI search",
    "AI image generation",
    "AriaMindX AI"
  ]),
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "AriaMindX",
    title: "AriaMindX — Aria Mind X AI Assistant",
    description:
      "AriaMindX (Aria Mind X) is an all-in-one AI assistant for chat, search, images, video, notebooks, translation and podcasts.",
    images: [
      {
        url: "/Aria%20logo/aria-icon.png",
        width: 512,
        height: 512,
        alt: "AriaMindX logo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "AriaMindX — Aria Mind X AI Assistant",
    description:
      "AriaMindX (Aria Mind X) — all-in-one AI assistant for chat, search, images, video and more.",
    images: ["/Aria%20logo/aria-icon.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
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

// Tells search engines that all of these spellings refer to the same brand.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AriaMindX",
  alternateName: BRAND_ALIASES,
  url: SITE_URL,
  logo: `${SITE_URL}/Aria%20logo/aria-icon.png`,
  description:
    "AriaMindX is an all-in-one AI assistant and workspace for chat, search, image and video generation, notebooks, translation and podcasts — every leading AI model in one place.",
  ...(BRAND_PROFILES.length > 0 ? { sameAs: BRAND_PROFILES } : {})
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AriaMindX",
  alternateName: BRAND_ALIASES,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`
    },
    "query-input": "required name=search_term_string"
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
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
