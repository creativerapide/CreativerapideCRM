import type { Opt } from "@/lib/constants";
import { daysBetween, todayISO } from "@/lib/format";

export const INVOICE_STATUS: Opt = {
  emisa: "Emisă",
  partial_incasata: "Parțial încasată",
  incasata: "Încasată",
  anulata: "Anulată",
};

export const COST_CATEGORY: Opt = {
  editor: "Editor",
  qc: "Quality check",
  management: "Management",
  alte: "Altele",
};

export const PAY_METHOD: Opt = {
  transfer: "Transfer bancar",
  card: "Card",
  numerar: "Numerar",
  ramburs: "Ramburs",
  altul: "Altul",
};

/** Normalizează parametrul ?luna=YYYY-MM; implicit luna curentă. */
export function monthParam(v?: string): string {
  if (v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return v;
  return todayISO().slice(0, 7);
}

export function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** from = prima zi (inclusiv), to = prima zi a lunii următoare (exclusiv) */
export function monthRange(m: string): { from: string; to: string } {
  return { from: `${m}-01`, to: `${shiftMonth(m, 1)}-01` };
}

export function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, mo - 1, 1)));
}

export function monthShort(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Intl.DateTimeFormat("ro-RO", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, mo - 1, 1)));
}

export const sum = (rows: { [k: string]: unknown }[] | null | undefined, key: string): number =>
  (rows ?? []).reduce((s, r) => s + Number(r[key] ?? 0), 0);

/* ───────── retenție ───────── */

export type RetentionBucket = { eligible: number; retained: number };
export type Retention = { r30: RetentionBucket; r60: RetentionBucket; r90: RetentionBucket; returned: number; clients: number };

/** Retenția la X zile: dintre clienții a căror primă comandă are cel puțin X zile, câți au mai comandat în X zile de la prima. */
export function computeRetention(orders: { client_id: string; order_date: string }[], today = todayISO()): Retention {
  const byClient = new Map<string, string[]>();
  for (const o of orders) {
    const arr = byClient.get(o.client_id) ?? [];
    arr.push(o.order_date);
    byClient.set(o.client_id, arr);
  }
  const res: Retention = {
    r30: { eligible: 0, retained: 0 },
    r60: { eligible: 0, retained: 0 },
    r90: { eligible: 0, retained: 0 },
    returned: 0,
    clients: byClient.size,
  };
  for (const dates of byClient.values()) {
    const d = Array.from(new Set(dates)).sort();
    const first = d[0];
    const later = d.slice(1);
    for (const [k, x] of [["r30", 30], ["r60", 60], ["r90", 90]] as const) {
      if (daysBetween(first, today) >= x) {
        res[k].eligible += 1;
        if (later.some((o) => daysBetween(first, o) <= x)) res[k].retained += 1;
      }
    }
    for (let i = 1; i < d.length; i++) {
      if (daysBetween(d[i - 1], d[i]) >= 30) {
        res.returned += 1;
        break;
      }
    }
  }
  return res;
}

export const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
