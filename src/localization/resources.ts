import { cs } from "./locales/cs";
import { de } from "./locales/de";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { sk } from "./locales/sk";
import { authorResources } from "./author-resources";

export const locales = ["en", "cs", "sk", "de", "fr", "es"] as const;
export type Locale = (typeof locales)[number];
export type Messages = Record<string, string>;

export const localeOptions: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: "en", label: "English" },
  { value: "cs", label: "Čeština" },
  { value: "sk", label: "Slovenčina" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

export function getLocaleLabel(locale: string) {
  return localeOptions.find((option) => option.value === locale)?.label ?? locale.toUpperCase();
}

function withEnglishFallback(messages: Partial<Messages>): Messages {
  return { ...en, ...messages };
}

export const resources: Record<Locale, Messages> = {
  en: { ...en, ...authorResources.en },
  cs: { ...cs, ...authorResources.cs },
  sk: { ...withEnglishFallback(sk), ...authorResources.sk },
  de: { ...withEnglishFallback(de), ...authorResources.de },
  fr: { ...withEnglishFallback(fr), ...authorResources.fr },
  es: { ...withEnglishFallback(es), ...authorResources.es },
};
