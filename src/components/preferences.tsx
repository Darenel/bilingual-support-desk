"use client";

import { createContext, useContext, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, DEFAULT_THEME, translate, type Locale, type Theme } from "@/lib/i18n";

type Preferences = {
  locale: Locale;
  theme: Theme;
  t: (key: string, values?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
};
const PreferencesContext = createContext<Preferences | null>(null);
const cookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
};

export function PreferencesProvider({ children, locale = DEFAULT_LOCALE, theme = DEFAULT_THEME }: { children: React.ReactNode; locale?: Locale; theme?: Theme }) {
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState(locale);
  const [currentTheme, setCurrentTheme] = useState(theme);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = currentTheme;
    document.documentElement.dataset.lang = currentLocale;
    document.documentElement.lang = currentLocale;
  }, [currentLocale, currentTheme]);
  const setLocale = (next: Locale) => {
    setCurrentLocale(next);
    cookie("locale", next);
    document.documentElement.dataset.lang = next;
    document.documentElement.lang = next;
    window.dispatchEvent(new CustomEvent("support-widget-preferences", { detail: { locale: next, language: next, theme: currentTheme } }));
    router.refresh();
  };
  const setTheme = (next: Theme) => {
    setCurrentTheme(next);
    document.documentElement.dataset.theme = next;
    cookie("theme", next);
    window.dispatchEvent(new CustomEvent("support-widget-preferences", { detail: { locale: currentLocale, language: currentLocale, theme: next } }));
  };
  return <PreferencesContext value={{ locale: currentLocale, theme: currentTheme, t: (key, values) => translate(currentLocale, key, values), setLocale, setTheme }}>{children}</PreferencesContext>;
}

export function useLocale() {
  const preferences = useContext(PreferencesContext);
  if (!preferences) throw new Error("useLocale must be used within PreferencesProvider");
  return preferences;
}

export function PreferenceControls() {
  const { locale, theme, setLocale, setTheme, t } = useLocale();
  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  return <div className="preferences" aria-label={t("preferences.language")}>
    <div role="group" aria-label={t("preferences.language")}>
      <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
      <button type="button" aria-pressed={locale === "es"} onClick={() => setLocale("es")}>ES</button>
    </div>
    <button type="button" aria-label={t(nextTheme === "light" ? "preferences.switchToLight" : "preferences.switchToDark")} onClick={() => setTheme(nextTheme)}>{theme === "dark" ? "☀" : "☾"}</button>
  </div>;
}
