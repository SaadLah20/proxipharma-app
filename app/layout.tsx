import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";
import { Noto_Sans_Arabic } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import { PlatformChrome } from "@/components/layout/platform-chrome";
import { PHARMETO_BRAND } from "@/lib/brand-theme";
import { localeDirection, type AppLocale } from "@/lib/i18n/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    metadataBase: new URL(PHARMETO_BRAND.productionUrl),
    title: t("siteTitle"),
    description: t("siteDescription"),
    applicationName: PHARMETO_BRAND.name,
    openGraph: {
      title: t("siteTitle"),
      description: t("siteDescription"),
      url: PHARMETO_BRAND.productionUrl,
      siteName: PHARMETO_BRAND.name,
      locale: "fr_MA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("siteTitle"),
      description: t("siteDescription"),
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as AppLocale;
  const messages = await getMessages();
  const dir = localeDirection(locale);
  const fontClass =
    locale === "ar"
      ? `${geistSans.variable} ${geistMono.variable} ${notoSansArabic.variable} font-[family-name:var(--font-noto-arabic)]`
      : `${geistSans.variable} ${geistMono.variable}`;

  return (
    <html lang={locale} dir={dir} className={`${fontClass} antialiased`}>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PlatformChrome>{children}</PlatformChrome>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
