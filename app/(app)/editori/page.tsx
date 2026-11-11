import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasFinance, requireActive } from "@/lib/session";
import { Badge, Card, Empty, Field, Flash, PageHeader, Stat, btnCls, btnGhost, btnSmall, inputCls, td, th } from "@/components/ui";
import { createEditor } from "@/app/editors-actions";
import { fmtRON, monthRange } from "@/lib/format";
import type { Row, SP } from "@/lib/types";

export default async function EditoriPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  if (!hasFinance(profile)) redirect("/");
  const sp = await searchParams;
  const { key, start, end, label } = monthRange(sp.luna);
  const supabase = await createClient();

  const [edR, workR] = await Promise.all([
    supabase.from("editors").select("*").order("active", { ascending: false }).order("name"),
    supabase.from("editor_work").select("editor_id, creatives, amount").gte("work_date", start).lt("work_date", end),
  ]);
  const editors: Row[] = edR.data ?? [];
  const work: Row[] = workR.data ?? [];
  const sum = new Map<string, { n: number; amount: number }>();
  for (const w of work) {
    const s = sum.get(w.editor_id) ?? { n: 0, amount: 0 };
    s.n += Number(w.creatives);
    s.amount += Number(w.amount);
    sum.set(w.editor_id, s);
  }
  const totalN = work.reduce((a, w) => a + Number(w.creatives), 0);
  const totalAmount = work.reduce((a, w) => a + Number(w.amount), 0);

  return (
    <>
      <PageHeader
        title="Editori"
        subtitle="Editorii nu au cont în CRM. Pe fiecare comandă trecem cine a făcut câte creative, iar aici vezi cât are de primit fiecare."
        actions={
          <form method="get" className="flex items-center gap-2">
            <input type="month" name="luna" defaultValue={key} className={inputCls} />
            <button className={btnGhost}>Arată</button>
          </form>
        }
      />
      <Flash sp={sp} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label={`Creative · ${label}`} value={totalN} hint="trecute pe editori" />
        <Stat label={`De plătit · ${label}`} value={fmtRON(totalAmount)} tone="amber" hint="suma tuturor editorilor" />
        <Stat label="Editori activi" value={editors.filter((e) => e.active).length} />
      </div>

      <Card title={`Cât are de primit fiecare · ${label}`} className="mb-6">
        {editors.length === 0 ? (
          <Empty text="Niciun editor încă. Adaugă primul mai jos." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  <th className={th}>Editor</th>
                  <th className={th}>Tarif / creativă</th>
                  <th className={th}>Creative</th>
                  <th className={th}>De primit</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {editors.map((e) => {
                  const s = sum.get(e.id);
                  return (
                    <tr key={e.id} className={e.active ? "" : "opacity-60"}>
                      <td className={td}>
                        <Link href={`/editori/${e.id}?luna=${key}`} className="font-medium text-indigo-700 hover:underline">{e.name}</Link>
                        {e.active ? null : <span className="ml-2"><Badge tone="slate">inactiv</Badge></span>}
                      </td>
                      <td className={td}>{fmtRON(e.rate)}</td>
                      <td className={td}>{s?.n ?? 0}</td>
                      <td className={`${td} font-semibold text-slate-900`}>{fmtRON(s?.amount ?? 0)}</td>
                      <td className={td}><Link className={btnSmall} href={`/editori/${e.id}?luna=${key}`}>Detalii</Link></td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-semibold">
                  <td className={td}>Total</td>
                  <td className={td}></td>
                  <td className={td}>{totalN}</td>
                  <td className={td}>{fmtRON(totalAmount)}</td>
                  <td className={td}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Adaugă editor">
        <form action={createEditor} className="grid gap-4 sm:grid-cols-3">
          <Field label="Nume"><input name="name" required className={inputCls} placeholder="ex. Andrei" /></Field>
          <Field label="Tarif pe creativă (RON)" hint="Se completează automat când îl alegi pe o comandă. Îl poți schimba oricând."><input name="rate" inputMode="decimal" defaultValue="10" className={inputCls} /></Field>
          <Field label="Observații"><input name="notes" className={inputCls} placeholder="opțional" /></Field>
          <div className="sm:col-span-3"><button className={btnCls}>Adaugă editorul</button></div>
        </form>
      </Card>
    </>
  );
}
