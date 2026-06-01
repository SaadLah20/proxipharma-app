import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PlatformChrome } from "@/components/layout/platform-chrome";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProxiPharma",
  description: "Annuaire et services pharmacies au Maroc",
};

/** Autorise le zoom navigateur (accessibilité) — évite un viewport figé type maximum-scale=1. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <PlatformChrome>{children}</PlatformChrome>
      </body>
    </html>
  );
}
