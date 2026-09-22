import { cookies } from "next/headers";
import { DEFAULT_LOCALE, DEFAULT_THEME, isLocale, isTheme, type Locale, type Theme } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get("locale")?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get("theme")?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
}
