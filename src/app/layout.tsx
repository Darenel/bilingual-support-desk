import type { Metadata } from "next";
import "./globals.css";
import { PreferencesProvider } from "@/components/preferences";
import { getLocale, getTheme } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "Support Desk",
  description: "Clear customer support in two languages.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  return (
    <html lang={locale} data-lang={locale} data-theme={theme} suppressHydrationWarning>
      <head><meta name="darkreader-lock" content="true" /></head>
      <body>
        <PreferencesProvider locale={locale} theme={theme}>
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
