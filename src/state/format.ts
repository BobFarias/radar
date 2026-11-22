const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Formats an ISO date (YYYY-MM-DD) deterministically (same on server and client). */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date);
}

export function daysBetween(fromIso: string, toIso: string): number | null {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) ? null : Math.round((b - a) / 86_400_000);
}

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short" });
const shortDateTimeFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/**
 * Formats an ISO timestamp in the viewer's time zone. Client-only: use it for
 * data that is never server-rendered (e.g. browser-stored history).
 */
export function formatDateTime(iso: string, style: "long" | "short" = "long"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (style === "long" ? dateTimeFormat : shortDateTimeFormat).format(date);
}
