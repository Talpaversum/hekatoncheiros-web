export function parseAuditTime(value: string, now = new Date()): Date | null {
  const normalized = value.trim().toLocaleLowerCase();
  if (normalized === "now") return now;
  const relative = /^now-(\d+)(m|h|d)$/.exec(normalized);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const multiplier = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
    return new Date(now.getTime() - amount * multiplier);
  }
  const absolute = new Date(value.includes(" ") ? value.replace(" ", "T") : value);
  return Number.isNaN(absolute.getTime()) ? null : absolute;
}
