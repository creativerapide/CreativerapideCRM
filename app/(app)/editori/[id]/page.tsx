import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasFinance, requireActive } from "@/lib/session";
import { Card, Empty, Field, Flash, PageHeader, Stat, btnCls, btnGhost, btnSmall, inputCls, td, th } from "@/components/ui";
import { deleteEditorWork, updateEditor } from "@/app/editors-actions";
import EditWork from "@/components/EditWork";
import { fmtDate, fmtRON, monthRange } from "@/lib/format";
import { one, type Row, type SP } from "@/lib/types";

export default async function EditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const profile = await requireActive();
  if (!hasFinance(profile)) redirect("/");
  const { id } = await params;
  const sp = await searchParams;
  const { key, start, end, label } = monthRange(sp.luna);
  const supabase = await createClient();

  const [edR, workR] = await Promise.all([
    supabase.from("editors").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("editor_work")
      .select("id, order_id, creatives, rate, amount, work_date, notes, orders(number, client_name)")
      .eq("editor_id", id)
      .gte("work_date", start)
      .lt("work_date", end)
      .order("work_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  const e: Row | null = edR.data;
  if (!e) notFound();
  const rows: Row[] = workR.data ?? [];
  const totalN = rows.reduce((a, w) => a + Number(w.creatives), 0);
  const totalAmount = rows.reduce((a, w) => a + Number(w.amount), 0);
  const back = `/editori/${id}?luna=${key}`;

  return (
    <>
      <PageHeader
        title={e.name}
        subtitle={`Tarif implicit ${fmtRON(e.rate)} / creativă`}
        actions={
          <>
            <form method="get" className="flex items-center gap-2">
              <input type="month" name="luna" defaultValue={key} className={inputCls} />
              <button className={btnGhost}>Arată</button>
            </form>
            <Link href={`/editori?luna=${key}`} className={btnGhost}>← Editori</Link>
          </>
        }
      />
      <Flash sp={sp} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label={`Creative · ${label}`} value={totalN} />
        <Stat label={`De primit · ${label}`} value={fmtRON(totalAmount)} tone="amber" />
        <Stat label="Lucrări în lună" value={rows.length} />
      </div>

      <Card title={`Ce a făcut · ${label}`} className="mb-6">
        {rows.length === 0 ? (
          <Empty text="Nicio lucrare în luna aleasă. Le adaugi din pagina fiecărei comenzi." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  <th className={th}>Data</th>
                  <th className={th}>Comanda</th>
                  <th className={th}>Creative</th>
                  <th className={th}>Tarif</th>
                  <th className={th}>Total</th>
                  <th className={th}>Note</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((w) => {
                  const o = one(w.orders);
                  return (
                    <tr key={w.id}>
                      <td className={td}>{fmtDate(w.work_date)}</td>
                      <td className={td}>
                        {w.order_id ? <Link className="text-indigo-700 hover:underline" href={`/comenzi/${w.order_id}`}>#{o?.number ?? "?"}</Link> : <span className="text-slate-500">manual</span>}
                        <div className="text-xs text-slate-500">{o?.client_name}</div>
                      </td>
                      <td className={td}>{w.creatives}</td>
                      <td className={td}>{fmtRON(w.rate)}</td>
                      <td className={`${td} font-medium text-slate-900`}>{fmtRON(w.amount)}</td>
                      <td className={td}>{w.notes ?? ""}</td>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <EditWork w={w} back={back} />
                          <form action={deleteEditorWork}>
                            <input type="hidden" name="back" value={back} />
                            <input type="hidden" name="id" value={w.id} />
                            <button className={btnSmall}>Șterge</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-semibold">
                  <td className={td} colSpan={2}>Total</td>
                  <td className={td}>{totalN}</td>
                  <td className={td}></td>
                  <td className={td}>{fmtRON(totalAmount)}</td>
                  <td className={td} colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Date editor">
        <form action={updateEditor} className="grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="id" value={id} />
          <Field label="Nume"><input name="name" required defaultValue={e.name} className={inputCls} /></Field>
          <Field label="Tarif implicit / creativă (RON)" hint="Se aplică doar lucrărilor adăugate după schimbare."><input name="rate" inputMode="decimal" defaultValue={e.rate} className={inputCls} /></Field>
          <Field label="Observații"><input name="notes" defaultValue={e.notes ?? ""} className={inputCls} /></Field>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-3"><input type="checkbox" name="active" defaultChecked={e.active} /> Activ (apare în lista de alegere pe comenzi)</label>
          <div className="sm:col-span-3"><button className={btnCls}>Salvează</button></div>
        </form>
      </Card>
    </>
  );
}
