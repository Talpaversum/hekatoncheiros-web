import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAppRegistryQuery } from "../../data/api/app-registry";
import { useContextQuery } from "../../data/api/context";
import { useLocalization } from "../../localization/LocalizationProvider";
import { Card } from "../../ui-kit/components/Card";
import { Input } from "../../ui-kit/components/Input";
import { PageHeader } from "../../ui-kit/components/Page";
import {
  findCategoryBySlug,
  getHelpCategoryPath,
  getVisiblePlatformHelpGuides,
  type HelpGuide,
} from "./help-guides";

function matchesQuery(item: HelpGuide, query: string) {
  if (!query.trim()) {
    return true;
  }

  const needle = query.trim().toLowerCase();
  return [item.title, item.summary, item.outcome, item.category, item.source, ...item.steps]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function HelpPage() {
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [query, setQuery] = useState("");
  const [openGuideKey, setOpenGuideKey] = useState<string | null>(null);
  const { data: context } = useContextQuery();
  const { data: registry, isLoading } = useAppRegistryQuery(true);
  const privileges = useMemo(() => context?.privileges ?? [], [context?.privileges]);
  const { t } = useLocalization();

  const allGuides = useMemo(() => {
    const visiblePlatformGuides = getVisiblePlatformHelpGuides(privileges, t);
    const appGuides =
      registry?.items.flatMap((app) =>
        (app.help_entries ?? []).map((entry) => ({
          title: entry.title,
          summary: entry.summary,
          outcome: entry.outcome,
          category: entry.category ?? t("help.categoryApplications"),
          steps: entry.steps,
          path: entry.path,
          source: app.app_name ?? app.app_id,
          actionLabel: t("help.openAction"),
        })),
      ) ?? [];

    return [...visiblePlatformGuides, ...appGuides];
  }, [privileges, registry?.items, t]);

  const categories = useMemo(() => {
    return Array.from(new Set(allGuides.map((item) => item.category))).sort((a, b) => a.localeCompare(b));
  }, [allGuides]);

  const selectedCategory = findCategoryBySlug(categories, categorySlug);

  const helpGuides = useMemo(() => {
    return allGuides
      .filter((item) => matchesQuery(item, query))
      .filter((item) => !categorySlug || item.category === selectedCategory)
      .sort((a, b) => `${a.category}:${a.title}`.localeCompare(`${b.category}:${b.title}`));
  }, [allGuides, categorySlug, query, selectedCategory]);

  const groupedGuides = useMemo(() => {
    return helpGuides.reduce<Record<string, HelpGuide[]>>((groups, item) => {
      groups[item.category] = [...(groups[item.category] ?? []), item];
      return groups;
    }, {});
  }, [helpGuides]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("nav.help")}
        title={selectedCategory ?? t("help.title")}
        description={selectedCategory ? t("help.selectedDescription") : t("help.description")}
        actions={<div className="w-full sm:w-80">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("help.search")} />
        </div>}
      />

      <div className="flex flex-wrap gap-1.5 border-b border-hc-outline pb-3">
        <Link
          to="/core/help"
          className={`rounded-hc-sm border px-3 py-1.5 text-sm transition ${
            !categorySlug
              ? "border-hc-primary bg-hc-primary text-hc-on-primary"
              : "border-hc-outline text-hc-text hover:bg-hc-surface-variant"
          }`}
        >
          {t("help.all")}
        </Link>
        {categories.map((category) => (
          <Link
            key={category}
            to={getHelpCategoryPath(category)}
            className={`rounded-hc-sm border px-3 py-1.5 text-sm transition ${
              selectedCategory === category
                ? "border-hc-primary bg-hc-primary text-hc-on-primary"
                : "border-hc-outline text-hc-text hover:bg-hc-surface-variant"
            }`}
          >
            {category}
          </Link>
        ))}
      </div>

      {isLoading && <div className="text-sm text-hc-muted">{t("help.loadingApps")}</div>}

      {categorySlug && !selectedCategory && !isLoading && (
        <Card>
          <div className="text-sm font-semibold">{t("help.sectionNotFound")}</div>
          <div className="mt-1 text-sm text-hc-muted">{t("help.sectionNotFoundDescription")}</div>
        </Card>
      )}

      <div className="space-y-4">
        {Object.entries(groupedGuides).map(([category, items]) => (
          <section key={category}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-hc-muted">{category}</div>
              <div className="text-xs text-hc-muted">{t("common.guidesCount", { count: items.length })}</div>
            </div>
            <div className="overflow-hidden rounded-hc-md border border-hc-outline bg-hc-surface">
              {items.map((item) => (
                <GuideDisclosure
                  key={`${item.source}-${item.path}-${item.title}`}
                  guide={item}
                  isOpen={openGuideKey === `${item.source}-${item.path}-${item.title}`}
                  onToggle={() => {
                    const key = `${item.source}-${item.path}-${item.title}`;
                    setOpenGuideKey((current) => (current === key ? null : key));
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {!isLoading && helpGuides.length === 0 && (
        <Card>
          <div className="text-sm font-semibold">{t("help.noResults")}</div>
          <div className="mt-1 text-sm text-hc-muted">{t("help.noResultsDescription")}</div>
        </Card>
      )}
    </div>
  );
}

function GuideDisclosure({
  guide,
  isOpen,
  onToggle,
}: {
  guide: HelpGuide;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { t } = useLocalization();
  const panelId = `help-guide-${guide.source}-${guide.path}-${guide.title}`.replace(/[^a-zA-Z0-9_-]+/g, "-");

  return (
    <div className="border-b border-hc-outline last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-hc-surface-variant"
      >
        <span>
          <span className="block text-sm font-semibold text-hc-text">{guide.title}</span>
          <span className="mt-1 block text-sm text-hc-muted">{guide.summary}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="hidden rounded-hc-sm bg-hc-surface-variant px-2 py-1 text-xs text-hc-muted sm:inline-flex">
            {guide.source}
          </span>
          <span className={`text-lg leading-none text-hc-muted transition ${isOpen ? "rotate-180" : ""}`}>⌄</span>
        </span>
      </button>

      {isOpen && (
        <div id={panelId} className="border-t border-hc-outline bg-hc-bg/40 px-5 py-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div>
              <ol className="space-y-3">
                {guide.steps.map((step, index) => (
                  <li key={`${guide.title}-${step}`} className="flex gap-3 text-sm text-hc-text">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-hc-primary text-xs font-semibold text-hc-on-primary">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <aside className="rounded-hc-md border border-hc-outline bg-hc-surface p-4">
              <div className="text-xs uppercase tracking-wide text-hc-muted">{t("help.outcome")}</div>
              <div className="mt-2 text-sm text-hc-text">{guide.outcome ?? t("help.defaultOutcome")}</div>
              <Link
                to={guide.path}
                className="mt-4 inline-flex rounded-hc-sm border border-hc-outline px-3 py-2 text-sm font-medium text-hc-text transition hover:bg-hc-surface-variant"
              >
                {guide.actionLabel ?? t("help.openAction")}
              </Link>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
