import type { Metadata } from "next";
import { ModeProvider } from "@/components/ModeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arya Mind",
  description: "Arya Mind AI dashboard",
  icons: {
    icon: [
      {
        url: "/aion-mind-logo.jpg",
        type: "image/jpeg"
      }
    ],
    shortcut: "/aion-mind-logo.jpg",
    apple: "/aion-mind-logo.jpg"
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
        <ModeProvider>{children}</ModeProvider>
      </body>
    </html>
  );
}
