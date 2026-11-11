const TZ = "Europe/Bucharest";

export function fmtDate(v?: string | Date | null): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function fmtDateTime(v?: string | Date | null): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function fmtRON(n?: number | string | null): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 2,
  }).format(isNaN(v) ? 0 : v);
}

/** Data de azi în Europa/București, ca YYYY-MM-DD */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function monthStartISO(): string {
  return todayISO().slice(0, 8) + "01";
}

export function nextMonthStartISO(): string {
  const [y, m] = todayISO().split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/** Interval [start, end) pentru o lună "YYYY-MM"; implicit luna curentă. */
export function monthRange(luna?: string | null): { key: string; start: string; end: string; label: string } {
  const key = luna && /^\d{4}-(0[1-9]|1[0-2])$/.test(luna) ? luna : todayISO().slice(0, 7);
  const [y, m] = key.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const label = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return { key, start: `${key}-01`, end: `${ny}-${String(nm).padStart(2, "0")}-01`, label };
}
