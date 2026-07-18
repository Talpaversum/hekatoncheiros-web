import { cs } from "./locales/cs";
import { de } from "./locales/de";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { sk } from "./locales/sk";
import { authorResources } from "./author-resources";
import workflowHelpData from "./workflow-help-resources.json";

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

function flattenWorkflowHelp(locale: Locale): Messages {
  const messages: Messages = {};
  for (const [guide, content] of Object.entries(workflowHelpData[locale])) {
    const prefix = `help.workflow.${guide}`;
    messages[`${prefix}.title`] = content.title;
    messages[`${prefix}.summary`] = content.summary;
    messages[`${prefix}.outcome`] = content.outcome;
    messages[`${prefix}.action`] = content.action;
    content.steps.forEach((step, index) => { messages[`${prefix}.step${index + 1}`] = step; });
  }
  return messages;
}

export const resources: Record<Locale, Messages> = {
  en: { ...en, ...authorResources.en, ...flattenWorkflowHelp("en") },
  cs: { ...cs, ...authorResources.cs, ...flattenWorkflowHelp("cs") },
  sk: { ...withEnglishFallback(sk), ...authorResources.sk, ...flattenWorkflowHelp("sk") },
  de: { ...withEnglishFallback(de), ...authorResources.de, ...flattenWorkflowHelp("de") },
  fr: { ...withEnglishFallback(fr), ...authorResources.fr, ...flattenWorkflowHelp("fr") },
  es: { ...withEnglishFallback(es), ...authorResources.es, ...flattenWorkflowHelp("es") },
};
