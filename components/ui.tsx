import Link from "next/link";
import type { ReactNode } from "react";
import { PAGE_SIZE } from "@/lib/constants";

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100";
export const btnCls =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
export const btnSmall =
  "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50";
export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50";

const tones: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
};

const toneMap: Record<string, string> = {
  activ: "green", livrata: "green", incasata: "green", multumit: "green", facut: "green", client: "green", scazut: "green",
  in_lucru: "blue", test: "blue", contactat_whatsapp: "blue", test_trimis: "blue", aprobata: "blue", verificare_qc: "indigo", calificat: "blue", facturata: "blue",
  pierdut: "red", anulata: "red", anulat: "red", nemultumit: "red", ridicat: "red", urgenta: "red",
  brief_incomplet: "amber", mediu: "amber", ridicata: "amber", revizii: "amber", in_pauza: "amber", partial_incasata: "amber", raspuns_email: "indigo",
};

export function Badge({ children, tone, value }: { children: ReactNode; tone?: string; value?: string }) {
  const t = tone ?? (value ? toneMap[value] : undefined) ?? "slate";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[t] ?? tones.slate}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title ? (
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "red" | "green" | "amber" }) {
  const color = tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Select({ name, options, defaultValue, required, empty }: { name: string; options: Record<string, string>; defaultValue?: string | null; required?: boolean; empty?: string }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required={required} className={inputCls}>
      {empty !== undefined ? <option value="">{empty}</option> : null}
      {Object.entries(options).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

export function Flash({ sp }: { sp: { ok?: string; eroare?: string } }) {
  if (sp.eroare)
    return <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{sp.eroare}</div>;
  if (sp.ok)
    return <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{sp.ok}</div>;
  return null;
}

export function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{text}</div>;
}

export function Pagination({ page, total, base }: { page: number; total: number; base: string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  const href = (p: number) => `${base}${base.includes("?") ? "&" : "?"}pagina=${p}`;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>
        Pagina {page} din {pages} · {total} înregistrări
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className={btnGhost} href={href(page - 1)}>
            ← Înapoi
          </Link>
        ) : null}
        {page < pages ? (
          <Link className={btnGhost} href={href(page + 1)}>
            Înainte →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
export const td = "px-3 py-2.5 text-sm text-slate-700 align-top";
