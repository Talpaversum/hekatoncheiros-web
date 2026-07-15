import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../utils";

export type MultiSelectOption = {
  value: string;
  label: string;
  secondary?: string;
  keywords?: string[];
  badgeClassName?: string;
};

type Props = {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange(value: string[]): void;
  searchPlaceholder: string;
  emptyLabel: string;
  doneLabel: string;
  className?: string;
};

export function SearchableMultiSelect({ label, options, value, onChange, searchPlaceholder, emptyLabel, doneLabel, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => options.filter((option) => value.includes(option.value)), [options, value]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return options;
    return options.filter((option) => [option.label, option.secondary, option.value, ...(option.keywords ?? [])].filter(Boolean).some((text) => text!.toLocaleLowerCase().includes(needle)));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const safeActiveIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0));

  const toggle = (option: MultiSelectOption) => {
    onChange(value.includes(option.value) ? value.filter((item) => item !== option.value) : [...value, option.value]);
  };

  return <div ref={rootRef} className={cn("relative", className)}>
    <button type="button" className="flex min-h-9 w-full items-center justify-between gap-2 rounded-hc-md border border-hc-outline bg-hc-surface px-3 py-1.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-hc-primary/40" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="listbox">
      <span className="truncate">{selected.length ? selected.map((option) => option.label).join(", ") : label}</span><span aria-hidden="true">▾</span>
    </button>
    {open && <div className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-[min(24rem,calc(100vw-2rem))] rounded-hc-md border border-hc-outline bg-hc-surface p-2 shadow-xl">
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-hc-md border border-hc-outline bg-hc-bg px-2 focus-within:ring-2 focus-within:ring-hc-primary/40">
        {selected.map((option) => <button key={option.value} type="button" className="rounded-full border border-hc-outline bg-hc-surface-variant px-2 py-0.5 text-xs" onClick={() => toggle(option)} title={option.secondary ?? option.value}>{option.label} ×</button>)}
        <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} placeholder={selected.length ? "" : searchPlaceholder} className="min-w-24 flex-1 bg-transparent px-1 py-2 text-sm outline-none" aria-label={searchPlaceholder}
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
            if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, filtered.length - 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
            if (event.key === "Enter" && filtered[safeActiveIndex]) { event.preventDefault(); toggle(filtered[safeActiveIndex]); }
            if (event.key === "Backspace" && !query && value.length) onChange(value.slice(0, -1));
          }} />
      </div>
      <div className="mt-2 max-h-64 overflow-y-auto" role="listbox" aria-multiselectable="true">
        {filtered.map((option, index) => {
          const isSelected = value.includes(option.value);
          return <button key={option.value} type="button" role="option" aria-selected={isSelected} className={cn("flex w-full items-center gap-3 rounded-hc-sm px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-hc-primary/40", index === safeActiveIndex && "bg-hc-surface-variant", isSelected && "text-hc-primary")} onMouseEnter={() => setActiveIndex(index)} onClick={() => toggle(option)}>
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full border border-current", isSelected && "bg-current", option.badgeClassName)} aria-hidden="true" />
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{option.label}</span>{option.secondary && <span className="block truncate text-xs text-hc-muted">{option.secondary}</span>}</span>
            {isSelected && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
          </button>;
        })}
        {!filtered.length && <div className="px-3 py-6 text-center text-sm text-hc-muted">{emptyLabel}</div>}
      </div>
      <div className="mt-2 flex justify-end border-t border-hc-outline pt-2"><button type="button" className="rounded-hc-sm px-3 py-1.5 text-xs font-semibold text-hc-primary hover:bg-hc-surface-variant" onClick={() => setOpen(false)}>{doneLabel}</button></div>
    </div>}
  </div>;
}
