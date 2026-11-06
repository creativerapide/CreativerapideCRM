import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasFinance, isAdmin, requireActive } from "@/lib/session";
import { Badge, Card, Empty, Field, Flash, PageHeader, Select, Stat, btnCls, btnGhost, btnSmall, inputCls, td, th } from "@/components/ui";
import FinanceChart, { type ChartPoint } from "@/components/FinanceChart";
import { addCost, addPayment, cancelInvoice, createInvoice, deleteCost } from "@/app/stage2-actions";
import { fmtDate, fmtRON, todayISO } from "@/lib/format";
import { COST_CATEGORY, INVOICE_STATUS, PAY_METHOD, monthLabel, monthParam, monthRange, monthShort, shiftMonth, sum } from "@/lib/finance";
import { one, type Row, type SP } from "@/lib/types";

export default async function FinancePage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  if (!hasFinance(profile)) redirect("/");
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayISO();
  const luna = monthParam(sp.luna);
  const { from, to } = monthRange(luna);
  const chartFrom = monthRange(shiftMonth(luna, -5)).from;
  const admin = isAdmin(profile);
  const back = `/finante?luna=${luna}`;

  const [invMonthR, payMonthR, costMonthR, openR, chartInvR, chartPayR, chartCostR, listR, costsListR, paysListR, clientsR, ordersR] = await Promise.all([
    supabase.from("invoices").select("amount").neq("status", "anulata").gte("issue_date", from).lt("issue_date", to),
    supabase.from("payments").select("amount").gte("paid_on", from).lt("paid_on", to),
    supabase.from("costs").select("amount").gte("incurred_on", from).lt("incurred_on", to),
    supabase.from("invoices").select("id, number, amount, due_date, clients(name), payments(amount)").in("status", ["emisa", "partial_incasata"]).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("invoices").select("amount, issue_date").neq("status", "anulata").gte("issue_date", chartFrom).lt("issue_date", to),
    supabase.from("payments").select("amount, paid_on").gte("paid_on", chartFrom).lt("paid_on", to),
    supabase.from("costs").select("amount, incurred_on").gte("incurred_on", chartFrom).lt("incurred_on", to),
    supabase.from("invoices").select("id, number, issue_date, due_date, amount, status, orders(number), clients(name), payments(amount)").order("issue_date", { ascending: false }).order("created_at", { ascending: false }).limit(60),
    supabase.from("costs").select("id, incurred_on, category, amount, description, clients(name), orders(number)").gte("incurred_on", from).lt("incurred_on", to).order("incurred_on", { ascending: false }).limit(100),
    supabase.from("payments").select("id, amount, paid_on, method, invoices(number, clients(name))").gte("paid_on", from).lt("paid_on", to).order("paid_on", { ascending: false }).limit(100),
    supabase.from("clients").select("id, name").eq("archived", false).order("name").limit(1000),
    supabase.from("orders").select("id, number, client_name").neq("status", "anulata").order("number", { ascending: false }).limit(300),
  ]);

  const invoicedMonth = sum(invMonthR.data, "amount");
  const collectedMonth = sum(payMonthR.data, "amount");
  const costsMonth = sum(costMonthR.data, "amount");
  const open: Row[] = openR.data ?? [];
  const remaining = (i: Row) => Number(i.amount) - sum(i.payments, "amount");
  const outstanding = open.reduce((s, i) => s + remaining(i), 0);
  const overdue = open.filter((i) => i.due_date && i.due_date < today).reduce((s, i) => s + remaining(i), 0);
  const margin = invoicedMonth - costsMonth;

  const months = Array.from({ length: 6 }, (_, k) => shiftMonth(luna, k - 5));
  const chart: ChartPoint[] = months.map((m) => {
    const inM = (d: string) => d.slice(0, 7) === m;
    return {
      luna: monthShort(m),
      facturat: sum((chartInvR.data ?? []).filter((r) => inM(r.issue_date)), "amount"),
      incasat: sum((chartPayR.data ?? []).filter((r) => inM(r.paid_on)), "amount"),
      costuri: sum((chartCostR.data ?? []).filter((r) => inM(r.incurred_on)), "amount"),
    };
  });

  const invoices: Row[] = listR.data ?? [];
  const costs: Row[] = costsListR.data ?? [];
  const pays: Row[] = paysListR.data ?? [];
  const clients: Row[] = clientsR.data ?? [];
  const orders: Row[] = ordersR.data ?? [];

  return (
    <>
      <PageHeader
        title="Finanțe"
        subtitle="Facturi, încasări și costuri directe. Marja este estimată, nu profit contabil."
        actions={
          <>
            <Link className={btnGhost} href={`/finante?luna=${shiftMonth(luna, -1)}`}>← {monthLabel(shiftMonth(luna, -1))}</Link>
            <span className="px-2 text-sm font-semibold capitalize text-slate-800">{monthLabel(luna)}</span>
            <Link className={btnGhost} href={`/finante?luna=${shiftMonth(luna, 1)}`}>{monthLabel(shiftMonth(luna, 1))} →</Link>
          </>
        }
      />
      <Flash sp={sp} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Stat label="Facturat în lună" value={fmtRON(invoicedMonth)} />
        <Stat label="Încasat în lună" value={fmtRON(collectedMonth)} tone="green" />
        <Stat label="De încasat (total)" value={fmtRON(outstanding)} hint={`din care restant: ${fmtRON(overdue)}`} tone={overdue > 0 ? "red" : undefined} />
        <Stat label="Costuri directe" value={fmtRON(costsMonth)} />
        <Stat label="Marjă estimată" value={fmtRON(margin)} hint="facturat − costuri directe" tone={margin < 0 ? "red" : undefined} />
      </div>

      <Card title="Ultimele 6 luni" className="mb-6">
        <FinanceChart data={chart} />
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">+ Factură</summary>
          <form action={createInvoice} className="grid gap-3 border-t border-slate-100 p-4">
            <input type="hidden" name="back" value={back} />
            <Field label="Număr factură *"><input name="number" required className={inputCls} placeholder="ex. CR-0012" /></Field>
            <Field label="Client *">
              <select name="client_id" required defaultValue="" className={inputCls}>
                <option value="" disabled>Alege clientul…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Comandă (opțional)">
              <select name="order_id" defaultValue="" className={inputCls}>
                <option value="">—</option>
                {orders.map((o) => <option key={o.id} value={o.id}>#{o.number} · {o.client_name}</option>)}
              </select>
            </Field>
            <Field label="Valoare (RON) *"><input name="amount" required inputMode="decimal" className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data emiterii"><input name="issue_date" type="date" defaultValue={today} className={inputCls} /></Field>
              <Field label="Scadență"><input name="due_date" type="date" className={inputCls} /></Field>
            </div>
            <div><button className={btnCls}>Salvează factura</button></div>
          </form>
        </details>

        <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">+ Încasare</summary>
          {open.length === 0 ? (
            <div className="border-t border-slate-100 p-4"><Empty text="Nicio factură de încasat." /></div>
          ) : (
            <form action={addPayment} className="grid gap-3 border-t border-slate-100 p-4">
              <input type="hidden" name="back" value={back} />
              <Field label="Factură *">
                <select name="invoice_id" required defaultValue="" className={inputCls}>
                  <option value="" disabled>Alege factura…</option>
                  {open.map((i) => <option key={i.id} value={i.id}>{i.number} · {one(i.clients)?.name} · rest {fmtRON(remaining(i))}</option>)}
                </select>
              </Field>
              <Field label="Sumă încasată (RON) *"><input name="amount" required inputMode="decimal" className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data încasării"><input name="paid_on" type="date" defaultValue={today} className={inputCls} /></Field>
                <Field label="Metodă"><Select name="method" options={PAY_METHOD} defaultValue="transfer" /></Field>
              </div>
              <div><button className={btnCls}>Înregistrează încasarea</button></div>
            </form>
          )}
        </details>

        <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">+ Cost direct</summary>
          <form action={addCost} className="grid gap-3 border-t border-slate-100 p-4">
            <input type="hidden" name="back" value={back} />
            <Field label="Categorie"><Select name="category" options={COST_CATEGORY} defaultValue="editor" /></Field>
            <Field label="Sumă (RON) *"><input name="amount" required inputMode="decimal" className={inputCls} /></Field>
            <Field label="Comandă (opțional)">
              <select name="order_id" defaultValue="" className={inputCls}>
                <option value="">—</option>
                {orders.map((o) => <option key={o.id} value={o.id}>#{o.number} · {o.client_name}</option>)}
              </select>
            </Field>
            <Field label="Client (dacă nu e legat de o comandă)">
              <select name="client_id" defaultValue="" className={inputCls}>
                <option value="">—</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data"><input name="incurred_on" type="date" defaultValue={today} className={inputCls} /></Field>
              <Field label="Descriere"><input name="description" className={inputCls} /></Field>
            </div>
            <div><button className={btnCls}>Salvează costul</button></div>
          </form>
        </details>
      </div>

      <Card title="Facturi recente" className="mb-6">
        {invoices.length === 0 ? (
          <Empty text="Nicio factură încă." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  <th className={th}>Număr</th><th className={th}>Client</th><th className={th}>Comandă</th><th className={th}>Emisă</th>
                  <th className={th}>Scadență</th><th className={th}>Valoare</th><th className={th}>Încasat</th><th className={th}>Status</th><th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((i) => {
                  const paid = sum(i.payments, "amount");
                  const late = i.due_date && i.due_date < today && ["emisa", "partial_incasata"].includes(i.status);
                  return (
                    <tr key={i.id}>
                      <td className={`${td} font-medium`}>{i.number}</td>
                      <td className={td}>{one(i.clients)?.name}</td>
                      <td className={td}>{one(i.orders) ? `#${one(i.orders)?.number}` : "—"}</td>
                      <td className={td}>{fmtDate(i.issue_date)}</td>
                      <td className={`${td} ${late ? "font-medium text-red-600" : ""}`}>{fmtDate(i.due_date)}{late ? " · restantă" : ""}</td>
                      <td className={td}>{fmtRON(i.amount)}</td>
                      <td className={td}>{fmtRON(paid)}</td>
                      <td className={td}><Badge value={i.status}>{INVOICE_STATUS[i.status]}</Badge></td>
                      <td className={td}>
                        {i.status !== "anulata" && paid === 0 ? (
                          <form action={cancelInvoice}>
                            <input type="hidden" name="back" value={back} />
                            <input type="hidden" name="id" value={i.id} />
                            <button className={btnSmall}>Anulează</button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Încasări în ${monthLabel(luna)}`}>
          {pays.length === 0 ? <Empty text="Nicio încasare în această lună." /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {pays.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium text-slate-900">{one(p.invoices)?.number} · {one(one(p.invoices)?.clients)?.name}</div>
                    <div className="text-xs text-slate-500">{fmtDate(p.paid_on)} · {PAY_METHOD[p.method]}</div>
                  </div>
                  <div className="font-medium text-emerald-700">{fmtRON(p.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Costuri directe în ${monthLabel(luna)}`}>
          {costs.length === 0 ? <Empty text="Niciun cost în această lună." /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {costs.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium text-slate-900">
                      {COST_CATEGORY[c.category]}
                      {one(c.orders) ? ` · comanda #${one(c.orders)?.number}` : ""}
                      {one(c.clients) ? ` · ${one(c.clients)?.name}` : ""}
                    </div>
                    <div className="text-xs text-slate-500">{fmtDate(c.incurred_on)}{c.description ? ` · ${c.description}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-amber-700">{fmtRON(c.amount)}</span>
                    {admin ? (
                      <form action={deleteCost}>
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="id" value={c.id} />
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
    </>
  );
}
