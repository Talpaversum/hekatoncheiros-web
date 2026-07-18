import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const locales = ["en", "cs", "sk", "de", "fr", "es"];
const data = JSON.parse(await readFile(resolve(root, "src/localization/workflow-help-resources.json"), "utf8"));

const flatten = (value, prefix = "") => Object.entries(value).flatMap(([key, item]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  if (Array.isArray(item)) return item.map((entry, index) => [`${path}.${index}`, entry]);
  if (item && typeof item === "object") return flatten(item, path);
  return [[path, item]];
});

const placeholders = (value) => [...value.matchAll(/{{\s*([\w.]+)\s*}}/g)].map((match) => match[1]).sort();
const expectedKeys = flatten(data.en).map(([key]) => key).sort();

for (const locale of locales) {
  if (!data[locale]) throw new Error(`Missing workflow help locale: ${locale}`);
  const entries = flatten(data[locale]);
  const keys = entries.map(([key]) => key).sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) throw new Error(`Key mismatch in locale ${locale}`);
  for (const [key, value] of entries) {
    if (typeof value !== "string" || value.trim() === "") throw new Error(`Empty value: ${locale}.${key}`);
    const reference = String(flatten(data.en).find(([candidate]) => candidate === key)?.[1] ?? "");
    if (JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(reference))) throw new Error(`Placeholder mismatch: ${locale}.${key}`);
  }
}

const auditedComponents = [
  "src/core-console/pages/developer/DeveloperToolsPage.tsx",
  "src/core-console/pages/author-workspace/AuthorOnboardingPage.tsx",
  "src/core-console/pages/author-workspace/AuthorWorkspacePage.tsx",
  "src/core-console/pages/platform-admin/authors/AuthorAdministrationPage.tsx",
  "src/core-console/pages/platform-admin/catalog/CatalogReviewPage.tsx",
  "src/core-console/pages/platform-admin/registry/RegistryAdministrationPage.tsx",
  "src/core-console/pages/platform-admin/runtime/RuntimeReviewPage.tsx"
];

for (const relativePath of auditedComponents) {
  const source = await readFile(resolve(root, relativePath), "utf8");
  const file = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const visit = (node) => {
    if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text.trim())) findings.push(node.text.trim());
    if (ts.isJsxAttribute(node) && ["title", "description", "label", "placeholder"].includes(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer) && /[A-Za-z]/.test(node.initializer.text)) findings.push(`${node.name.text}=${node.initializer.text}`);
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (findings.length) throw new Error(`Hardcoded user-facing text in ${relativePath}: ${findings.join(", ")}`);
}

console.log(`Localization contract passed for ${locales.length} locales and ${auditedComponents.length} components.`);
