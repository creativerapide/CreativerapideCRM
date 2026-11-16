import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasFinance, isAdmin, requireActive } from "@/lib/session";
import { Card, Empty, Field, Flash, PageHeader, Select, Stat, btnCls, btnGhost, btnSmall, inputCls } from "@/components/ui";
import { addExpense, addWithdrawal, deleteExpense, deleteWithdrawal } from "@/app/expenses-actions";
import { fmtDate, fmtRON, todayISO } from "@/lib/format";
import { EXPENSE_CATEGORY, PAY_METHOD_INPUT, monthLabel, monthParam, monthRange, shiftMonth, sum } from "@/lib/finance";
import type { Row, SP } from "@/lib/types";

export default async function ExpensesPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  if (!hasFinance(profile)) redirect("/");
  const sp = await searchParams;
  const supabase = await createClient();
  const luna = monthParam(sp.luna);
  const { from, to } = monthRange(luna);
  const admin = isAdmin(profile);
  const back = `/cheltuieli?luna=${luna}`;

  const [payAllR, workAllR, expAllR, wdAllR, expMonthR, wdMonthR] = await Promise.all([
    supabase.from("payments").select("amount").limit(20000),
    supabase.from("editor_work").select("amount, paid_at").limit(20000),
    supabase.from("expenses").select("amount").limit(20000),
    supabase.from("withdrawals").select("amount").limit(20000),
    supabase.from("expenses").select("id, spent_on, description, category, amount, paid_from").gte("spent_on", from).lt("spent_on", to).order("spent_on", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    supabase.from("withdrawals").select("id, taken_on, amount, note").gte("taken_on", from).lt("taken_on", to).order("taken_on", { ascending: false }).order("created_at", { ascending: false }).limit(300),
  ]);

  const collected = sum(payAllR.data, "amount");
  const work: Row[] = workAllR.data ?? [];
  const editorsTotal = sum(work, "amount");
  const editorsPaid = sum(work.filter((w) => w.paid_at), "amount");
  const editorsUnpaid = editorsTotal - editorsPaid;
  const afterEditors = collected - editorsTotal;
  const expensesTotal = sum(expAllR.data, "amount");
  const withdrawnTotal = sum(wdAllR.data, "amount");
  const available = afterEditors - expensesTotal - withdrawnTotal;

  const expMonth: Row[] = expMonthR.data ?? [];
  const wdMonth: Row[] = wdMonthR.data ?? [];

  return (
    <>
      <PageHeader
        title="Cheltuieli și extrageri"
        subtitle="Ce ai cheltuit din firmă, pe ce și când, plus banii extrași din încasări."
        actions={
          <>
            <Link className={btnGhost} href={`/cheltuieli?luna=${shiftMonth(luna, -1)}`}>← {monthLabel(shiftMonth(luna, -1))}</Link>
            <span className="px-2 text-sm font-semibold capitalize text-slate-800">{monthLabel(luna)}</span>
            <Link className={btnGhost} href={`/cheltuieli?luna=${shiftMonth(luna, 1)}`}>{monthLabel(shiftMonth(luna, 1))} →</Link>
          </>
        }
      />
      <Flash sp={sp} />

      <Card title="Sold (de la început până azi)" className="mb-6">
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Total încasat" value={fmtRON(collected)} tone="green" />
          <Stat label="− Editori" value={fmtRON(editorsTotal)} hint={`plătiți ${fmtRON(editorsPaid)} · de plătit ${fmtRON(editorsUnpaid)}`} tone="amber" />
          <Stat label="= După editori" value={fmtRON(afterEditors)} />
          <Stat label="− Cheltuieli" value={fmtRON(expensesTotal)} tone="amber" />
          <Stat label="− Extrageri" value={fmtRON(withdrawnTotal)} tone="amber" />
          <Stat label="= Disponibil" value={fmtRON(available)} tone={available < 0 ? "red" : "green"} hint="încasat − editori − cheltuieli − extrageri" />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <details className="rounded-xl border border-slate-200 bg-white shadow-sm" open>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">+ Cheltuială</summary>
            <form action={addExpense} className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
              <input type="hidden" name="back" value={back} />
              <div className="sm:col-span-2">
                <Field label="Pe ce ai cheltuit"><input name="description" required className={inputCls} placeholder="ex. Reclame Meta, abonament CapCut…" /></Field>
              </div>
              <Field label="Cât (RON)"><input name="amount" required inputMode="decimal" className={inputCls} placeholder="ex. 250" /></Field>
              <Field label="Când"><input name="spent_on" type="date" defaultValue={todayISO()} className={inputCls} /></Field>
              <Field label="Categorie"><Select name="category" options={EXPENSE_CATEGORY} empty="—" /></Field>
              <Field label="Plătit din"><Select name="paid_from" options={PAY_METHOD_INPUT} defaultValue="transfer" required /></Field>
              <div className="sm:col-span-2"><button className={btnCls}>Adaugă cheltuiala</button></div>
            </form>
          </details>

          <Card title={`Cheltuieli în ${monthLabel(luna)} · ${fmtRON(sum(expMonth, "amount"))}`}>
            {expMonth.length === 0 ? <Empty text="Nicio cheltuială în această lună." /> : (
              <ul className="divide-y divide-slate-100 px-4 text-sm">
                {expMonth.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <div className="font-medium text-slate-900">{e.description}</div>
                      <div className="text-xs text-slate-500">
                        {fmtDate(e.spent_on)}
                        {e.category ? ` · ${EXPENSE_CATEGORY[e.category] ?? e.category}` : ""}
                        {` · ${e.paid_from === "card" ? "Card" : "Cont firmă"}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-amber-700">{fmtRON(e.amount)}</span>
                      {admin ? (
                        <form action={deleteExpense}>
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="id" value={e.id} />
                          <button className={btnSmall}>Șterge</button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <details className="rounded-xl border border-slate-200 bg-white shadow-sm" open>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">+ Extragere din bani</summary>
            <form action={addWithdrawal} className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
              <input type="hidden" name="back" value={back} />
              <Field label="Cât extragi (RON)"><input name="amount" required inputMode="decimal" className={inputCls} placeholder="ex. 1000" /></Field>
              <Field label="Când"><input name="taken_on" type="date" defaultValue={todayISO()} className={inputCls} /></Field>
              <div className="sm:col-span-2">
                <Field label="Notă (opțional)"><input name="note" className={inputCls} placeholder="ex. retragere personală" /></Field>
              </div>
              <div className="sm:col-span-2"><button className={btnCls}>Adaugă extragerea</button></div>
            </form>
          </details>

          <Card title={`Extrageri în ${monthLabel(luna)} · ${fmtRON(sum(wdMonth, "amount"))}`}>
            {wdMonth.length === 0 ? <Empty text="Nicio extragere în această lună." /> : (
              <ul className="divide-y divide-slate-100 px-4 text-sm">
                {wdMonth.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <div className="font-medium text-slate-900">{w.note || "Extragere"}</div>
                      <div className="text-xs text-slate-500">{fmtDate(w.taken_on)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-amber-700">{fmtRON(w.amount)}</span>
                      {admin ? (
                        <form action={deleteWithdrawal}>
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="id" value={w.id} />
                          <button className={btnSmall}>Șterge</button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
