import type { Metadata } from "next";
import { AppMotionProvider } from "@/components/AppMotionProvider";
import { ModeProvider } from "@/components/ModeProvider";
import { ScrollToTopOnLoad } from "@/components/ScrollToTopOnLoad";
import "./globals.css";

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
    <html lang="en">
      <body>
        <ScrollToTopOnLoad />
        <AppMotionProvider>
          <ModeProvider>{children}</ModeProvider>
        </AppMotionProvider>
      </body>
    </html>
  );
}
