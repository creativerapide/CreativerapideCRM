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

  const [payAllR, ordersR, workAllR, expAllR, wdAllR, expMonthR, wdMonthR] = await Promise.all([
    supabase.from("payments").select("amount").limit(20000),
    supabase.from("orders").select("total").neq("status", "anulata").limit(20000),
    supabase.from("editor_work").select("amount, paid_at").limit(20000),
    supabase.from("expenses").select("amount").limit(20000),
    supabase.from("withdrawals").select("amount").limit(20000),
    supabase.from("expenses").select("id, spent_on, description, category, amount, paid_from").gte("spent_on", from).lt("spent_on", to).order("spent_on", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    supabase.from("withdrawals").select("id, taken_on, amount, note").gte("taken_on", from).lt("taken_on", to).order("taken_on", { ascending: false }).order("created_at", { ascending: false }).limit(300),
  ]);

  const collected = sum(payAllR.data, "amount");
  const ordersTotal = sum(ordersR.data, "total");
  const toCollect = Math.max(ordersTotal - collected, 0);
  const grandTotal = collected + toCollect;
  const work: Row[] = workAllR.data ?? [];
  const editorsTotal = sum(work, "amount");
  const editorsPaid = sum(work.filter((w) => w.paid_at), "amount");
  const editorsUnpaid = editorsTotal - editorsPaid;
  const expensesTotal = sum(expAllR.data, "amount");
  const withdrawnTotal = sum(wdAllR.data, "amount");
  const available = collected - editorsTotal - expensesTotal - withdrawnTotal;

  const expMonth: Row[] = expMonthR.data ?? [];
  const wdMonth: Row[] = wdMonthR.data ?? [];
  const liCls = "flex items-center justify-between gap-3 px-4 py-3";

  return (
    <>
      <PageHeader
        title="Cheltuieli și extrageri"
        subtitle="Ce ai cheltuit din firmă, pe ce și când, plus banii extrași din încasări."
        actions={
          <>
            <Link className={btnGhost} href={`/cheltuieli?luna=${shiftMonth(luna, -1)}`}>← {monthLabel(shiftMonth(luna, -1))}</Link>
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold capitalize text-slate-800">{monthLabel(luna)}</span>
            <Link className={btnGhost} href={`/cheltuieli?luna=${shiftMonth(luna, 1)}`}>{monthLabel(shiftMonth(luna, 1))} →</Link>
          </>
        }
      />
      <Flash sp={sp} />

      <div className="mb-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Încasat" value={fmtRON(collected)} tone="green" hint="bani intrați până acum" />
          <Stat label="De încasat" value={fmtRON(toCollect)} tone="amber" hint="comenzi nepredate sau neîncasate" />
          <Stat label="Total (încasat + de încasat)" value={fmtRON(grandTotal)} hint="valoarea tuturor comenzilor active" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Editori" value={fmtRON(editorsTotal)} tone="amber" hint={`plătiți ${fmtRON(editorsPaid)} · de plătit ${fmtRON(editorsUnpaid)}`} />
          <Stat label="Cheltuieli" value={fmtRON(expensesTotal)} tone="amber" hint="din firmă, total" />
          <Stat label="Extrageri" value={fmtRON(withdrawnTotal)} tone="amber" hint="bani scoși, total" />
          <Stat label="Disponibil acum" value={fmtRON(available)} tone={available < 0 ? "red" : "green"} hint="încasat − editori − cheltuieli − extrageri" />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title="Adaugă cheltuială">
            <form action={addExpense} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="back" value={back} />
              <Field label="Pe ce ai cheltuit" className="sm:col-span-2"><input name="description" required className={inputCls} placeholder="ex. Reclame Meta, abonament CapCut…" /></Field>
              <Field label="Cât (RON)"><input name="amount" required inputMode="decimal" className={inputCls} placeholder="ex. 250" /></Field>
              <Field label="Când"><input name="spent_on" type="date" defaultValue={todayISO()} className={inputCls} /></Field>
              <Field label="Categorie"><Select name="category" options={EXPENSE_CATEGORY} empty="—" /></Field>
              <Field label="Plătit din"><Select name="paid_from" options={PAY_METHOD_INPUT} defaultValue="transfer" required /></Field>
              <div className="sm:col-span-2"><button className={btnCls}>Adaugă cheltuiala</button></div>
            </form>
          </Card>

          <Card title={`Cheltuieli · ${monthLabel(luna)} · ${fmtRON(sum(expMonth, "amount"))}`}>
            {expMonth.length === 0 ? <Empty text="Nicio cheltuială în această lună." /> : (
              <ul className="-m-4 divide-y divide-slate-100 text-sm">
                {expMonth.map((e) => (
                  <li key={e.id} className={liCls}>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{e.description}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {fmtDate(e.spent_on)}
                        {e.category ? ` · ${EXPENSE_CATEGORY[e.category] ?? e.category}` : ""}
                        {` · ${e.paid_from === "card" ? "Card" : "Cont firmă"}`}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-semibold tabular-nums text-amber-700">{fmtRON(e.amount)}</span>
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
          <Card title="Adaugă extragere">
            <form action={addWithdrawal} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="back" value={back} />
              <Field label="Cât extragi (RON)"><input name="amount" required inputMode="decimal" className={inputCls} placeholder="ex. 1000" /></Field>
              <Field label="Când"><input name="taken_on" type="date" defaultValue={todayISO()} className={inputCls} /></Field>
              <Field label="Notă (opțional)" className="sm:col-span-2"><input name="note" className={inputCls} placeholder="ex. retragere personală" /></Field>
              <div className="sm:col-span-2"><button className={btnCls}>Adaugă extragerea</button></div>
            </form>
          </Card>

          <Card title={`Extrageri · ${monthLabel(luna)} · ${fmtRON(sum(wdMonth, "amount"))}`}>
            {wdMonth.length === 0 ? <Empty text="Nicio extragere în această lună." /> : (
              <ul className="-m-4 divide-y divide-slate-100 text-sm">
                {wdMonth.map((w) => (
                  <li key={w.id} className={liCls}>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{w.note || "Extragere"}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{fmtDate(w.taken_on)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-semibold tabular-nums text-amber-700">{fmtRON(w.amount)}</span>
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
