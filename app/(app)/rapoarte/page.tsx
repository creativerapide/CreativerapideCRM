import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActive } from "@/lib/session";
import { Card, Empty, PageHeader, Stat, btnSmall, td, th } from "@/components/ui";
import { LEAD_STAGES, SOURCES } from "@/lib/constants";
import { computeRetention, monthLabel, monthParam, pct, shiftMonth } from "@/lib/finance";
import type { Row } from "@/lib/types";

export default async function ReportsPage() {
  const profile = await requireActive();
  if (profile.role === "editor") redirect("/comenzi");
  const supabase = await createClient();
  const cur = monthParam();
  const prev = shiftMonth(cur, -1);

  const [ordersR, leadsR, clientsR] = await Promise.all([
    supabase.from("orders").select("client_id, order_date").neq("status", "anulata"),
    supabase.from("leads").select("stage, source, email_variant, client_id").eq("archived", false).limit(5000),
    supabase.from("clients").select("id, name, status").eq("archived", false).in("status", ["activ", "test", "in_pauza"]).order("name"),
  ]);
  const ret = computeRetention((ordersR.data ?? []) as { client_id: string; order_date: string }[]);
  const leads: Row[] = leadsR.data ?? [];
  const clients: Row[] = clientsR.data ?? [];

  const byStage = Object.keys(LEAD_STAGES).map((k) => ({ k, n: leads.filter((l) => l.stage === k).length }));
  const converted = leads.filter((l) => l.client_id).length;

  const group = (key: "source" | "email_variant") => {
    const m = new Map<string, { leads: number; clients: number }>();
    for (const l of leads) {
      const raw = (l[key] as string | null) || "—";
      const label = key === "source" ? (SOURCES[raw] ?? raw) : raw;
      const e = m.get(label) ?? { leads: 0, clients: 0 };
      e.leads += 1;
      if (l.client_id) e.clients += 1;
      m.set(label, e);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].leads - a[1].leads);
  };
  const bySource = group("source");
  const byVariant = group("email_variant");

  return (
    <>
      <PageHeader title="Rapoarte" subtitle="Retenție, conversie lead → client și rapoarte lunare pe client." />

      <Card title="Retenție" className="mb-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="La 30 de zile" value={pct(ret.r30.retained, ret.r30.eligible)} hint={`${ret.r30.retained} din ${ret.r30.eligible} clienți`} />
          <Stat label="La 60 de zile" value={pct(ret.r60.retained, ret.r60.eligible)} hint={`${ret.r60.retained} din ${ret.r60.eligible} clienți`} />
          <Stat label="La 90 de zile" value={pct(ret.r90.retained, ret.r90.eligible)} hint={`${ret.r90.retained} din ${ret.r90.eligible} clienți`} />
          <Stat label="Au revenit după pauză" value={ret.returned} hint="comandă după ≥ 30 de zile de la precedenta" />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Retenția la X zile = dintre clienții a căror primă comandă are cel puțin X zile, câți au mai comandat în primele X zile. Se calculează din comenzile neanulate ({ret.clients} clienți cu comenzi).
        </p>
      </Card>

      <Card title="Conversie lead → client" className="mb-6">
        {leads.length === 0 ? <Empty text="Nu există lead-uri încă." /> : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
              {byStage.map((s) => <Stat key={s.k} label={LEAD_STAGES[s.k]} value={s.n} />)}
              <Stat label="Conversie" value={pct(converted, leads.length)} hint={`${converted} din ${leads.length}`} tone="green" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Pe sursă</h3>
                <table className="min-w-full divide-y divide-slate-100">
                  <thead><tr><th className={th}>Sursă</th><th className={th}>Lead-uri</th><th className={th}>Clienți</th><th className={th}>Conversie</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {bySource.map(([k, v]) => <tr key={k}><td className={td}>{k}</td><td className={td}>{v.leads}</td><td className={td}>{v.clients}</td><td className={td}>{pct(v.clients, v.leads)}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Pe varianta de email</h3>
                <table className="min-w-full divide-y divide-slate-100">
                  <thead><tr><th className={th}>Variantă</th><th className={th}>Lead-uri</th><th className={th}>Clienți</th><th className={th}>Conversie</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {byVariant.map(([k, v]) => <tr key={k}><td className={td}>{k}</td><td className={td}>{v.leads}</td><td className={td}>{v.clients}</td><td className={td}>{pct(v.clients, v.leads)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Cu puține lead-uri, procentele variază mult de la o variantă la alta. Completează câmpurile „Sursă” și „Varianta de email” la fiecare lead ca analiza să devină utilă.</p>
          </>
        )}
      </Card>

      <Card title="Raport lunar pe client">
        {clients.length === 0 ? <Empty text="Nu există clienți activi." /> : (
          <table className="min-w-full divide-y divide-slate-100">
            <thead><tr><th className={th}>Client</th><th className={th}>{monthLabel(prev)}</th><th className={th}>{monthLabel(cur)}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className={td}><Link className="font-medium text-indigo-700 hover:underline" href={`/clienti/${c.id}`}>{c.name}</Link></td>
                  <td className={td}><Link className={btnSmall} href={`/clienti/${c.id}/raport?luna=${prev}`}>Deschide</Link></td>
                  <td className={td}><Link className={btnSmall} href={`/clienti/${c.id}/raport?luna=${cur}`}>Deschide</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
