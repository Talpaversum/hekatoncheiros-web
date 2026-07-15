import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";

import { locales, resources, type Locale } from "./resources";

type LocalizationContextValue = {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: string, values?: Record<string, string | number>): string;
};

export type Translate = LocalizationContextValue["t"];

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

function initialLocale(): Locale {
  const stored = localStorage.getItem("hc.locale");
  return locales.includes(stored as Locale) ? (stored as Locale) : "en";
}

export function LocalizationProvider({ children }: PropsWithChildren) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem("hc.locale", next);
    document.documentElement.lang = next;
    updateLocale(next);
  }, []);
  const value = useMemo<LocalizationContextValue>(() => ({
    locale,
    setLocale,
    t(key, values = {}) {
      const template = resources[locale][key] ?? resources.en[key] ?? key;
      return template.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g, (_match, name: string) =>
        Object.hasOwn(values, name) ? String(values[name]) : `{{${name}}}`,
      );
    },
  }), [locale, setLocale]);
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLocalization() {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error("useLocalization must be used inside LocalizationProvider");
  return value;
}
