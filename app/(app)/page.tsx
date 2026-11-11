import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasFinance, requireActive } from "@/lib/session";
import { Badge, Card, Empty, Flash, PageHeader, Stat, td, th, btnSmall, btnCls, btnGhost } from "@/components/ui";
import DashboardFinance from "@/components/DashboardFinance";
import { fmtDate, fmtRON, todayISO, monthStartISO, nextMonthStartISO, daysBetween } from "@/lib/format";
import { LEAD_STAGES, ORDER_STATUS, PRIORITY, TARGET_LUNAR_RON, ZILE_FARA_COMANDA_RISC } from "@/lib/constants";
import { one, type Row, type SP } from "@/lib/types";

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  if (profile.role === "editor") redirect("/comenzi");
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayISO();

  const [leadsR, tasksR, clientsR, statsR, openOrdersR, monthOrdersR, promisesR, payMonthR, unpaidR, monthCreativesR] = await Promise.all([
    supabase.from("leads").select("id, store_name, stage, next_step, next_step_at, created_at, owner_id").eq("archived", false).in("stage", ["raspuns_email", "contactat_whatsapp", "test_trimis"]).order("created_at", { ascending: true }),
    supabase.from("tasks").select("id, title, due_date, priority, status, client_id, lead_id, clients(name), leads(store_name)").in("status", ["de_facut", "in_lucru"]).order("due_date", { ascending: true, nullsFirst: false }).limit(200),
    supabase.from("clients").select("id, name, status, risk_level, risk_reason").eq("archived", false),
    supabase.from("client_stats").select("client_id, last_order_date, orders_count"),
    supabase.from("orders").select("id, number, client_name, status, deadline, total").not("status", "in", "(livrata,anulata)").order("deadline", { ascending: true, nullsFirst: false }).limit(200),
    supabase.from("orders").select("total").neq("status", "anulata").gte("order_date", monthStartISO()).lt("order_date", nextMonthStartISO()),
    supabase.from("interactions").select("id, promise, promise_due, clients(name), leads(store_name), client_id, lead_id").eq("cancelled", false).eq("promise_done", false).not("promise", "is", null).order("promise_due", { ascending: true, nullsFirst: false }).limit(50),
    hasFinance(profile) ? supabase.from("payments").select("amount").gte("paid_on", monthStartISO()).lt("paid_on", nextMonthStartISO()) : Promise.resolve({ data: [] as Row[] }),
    supabase.from("orders").select("total").neq("status", "anulata").neq("financial_status", "incasata"),
    supabase.from("orders").select("creatives_count, status").neq("status", "anulata").gte("order_date", monthStartISO()).lt("order_date", nextMonthStartISO()),
  ]);

  const leads: Row[] = leadsR.data ?? [];
  const tasks: Row[] = tasksR.data ?? [];
  const clients: Row[] = clientsR.data ?? [];
  const stats = new Map<string, Row>((statsR.data ?? []).map((s: Row) => [s.client_id, s]));
  const openOrders: Row[] = openOrdersR.data ?? [];
  const promises: Row[] = promisesR.data ?? [];

  const revenue = (monthOrdersR.data ?? []).reduce((sum: number, o: Row) => sum + Number(o.total ?? 0), 0);
  const collectedMonth = (payMonthR.data ?? []).reduce((sum: number, o: Row) => sum + Number(o.amount ?? 0), 0);
  const toCollect = (unpaidR.data ?? []).reduce((sum: number, o: Row) => sum + Number(o.total ?? 0), 0);
  const monthCreatives: Row[] = monthCreativesR.data ?? [];
  const creativesMonth = monthCreatives.reduce((sum: number, o: Row) => sum + Number(o.creatives_count ?? 0), 0);
  const creativesDelivered = monthCreatives.filter((o) => o.status === "livrata").reduce((sum: number, o: Row) => sum + Number(o.creatives_count ?? 0), 0);
  const showMoney = hasFinance(profile);
  const pct = Math.min(100, Math.round((revenue / TARGET_LUNAR_RON) * 100));
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
  const projection = dayOfMonth > 0 ? Math.round((revenue / dayOfMonth) * daysInMonth) : 0;

  const tasksToday = tasks.filter((t) => t.due_date === today);
  const tasksOverdue = tasks.filter((t) => t.due_date && t.due_date < today);
  const lateOrders = openOrders.filter((o) => o.deadline && o.deadline < today);
  const activeClients = clients.filter((c) => c.status === "activ");
  const atRisk = clients
    .filter((c) => ["activ", "test"].includes(c.status))
    .map((c): Row => {
      const st = stats.get(c.id);
      const idle = st?.last_order_date ? daysBetween(st.last_order_date, today) : null;
      const reasons: string[] = [];
      if (c.risk_level === "ridicat") reasons.push(c.risk_reason || "Marcat cu risc ridicat");
      if (c.status === "activ" && idle !== null && idle >= ZILE_FARA_COMANDA_RISC) reasons.push(`Nicio comandă de ${idle} zile`);
      return { ...c, reasons };
    })
    .filter((c) => c.reasons.length);
  const waiting = leads.filter((l) => l.stage === "raspuns_email");
  const overduePromises = promises.filter((p) => p.promise_due && p.promise_due < today);

  const nameOf = (r: Row) => one(r.clients)?.name ?? one(r.leads)?.store_name ?? "—";

  return (
    <>
      <PageHeader title="Acasă" subtitle={`Astăzi, ${fmtDate(today)}`} />
      <Flash sp={sp} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Link href="/comenzi?nou=1#nou" className={`${btnCls} justify-center py-3 text-base`}>+ Comandă nouă</Link>
        {showMoney ? <Link href="/comenzi?neincasate=1" className={`${btnCls} justify-center bg-emerald-600 py-3 text-base hover:bg-emerald-700`}>Încasare nouă</Link> : null}
        <Link href="/lead-uri?nou=1" className={`${btnGhost} justify-center py-3 text-base`}>+ Lead nou</Link>
      </div>

      <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-indigo-700">Creative luna aceasta</div>
        <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
          <div className="text-4xl font-semibold text-indigo-900">{creativesMonth}</div>
          <div className="pb-1 text-sm text-indigo-800">{creativesDelivered} livrate · {creativesMonth - creativesDelivered} în lucru</div>
        </div>
        <p className="mt-1 text-xs text-indigo-700/80">Din comenzile create luna aceasta, fără cele anulate.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Comenzi luna aceasta" value={fmtRON(revenue)} hint="valoarea comenzilor" />
        {showMoney ? <Stat label="Încasat luna aceasta" value={fmtRON(collectedMonth)} tone="green" hint="bani intrați" /> : null}
        <Stat label="De încasat" value={fmtRON(toCollect)} tone={toCollect > 0 ? "amber" : undefined} hint="comenzi neîncasate" />
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Țintă lunară (după valoarea comenzilor)</div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">{fmtRON(revenue)}</div>
          </div>
          <div className="text-right text-sm text-slate-600">
            <div>Țintă: {fmtRON(TARGET_LUNAR_RON)} ({pct}%)</div>
            <div className="text-xs text-slate-500">Proiecție la ritmul actual: {fmtRON(projection)}</div>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Calculat din comenzile create luna aceasta, fără cele anulate. „Încasat" este suma banilor intrați, afișată mai sus.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Clienți activi" value={activeClients.length} />
        <Stat label="Lead-uri deschise" value={leads.length} hint={`${waiting.length} așteaptă primul contact`} tone={waiting.length ? "amber" : undefined} />
        <Stat label="Taskuri azi / restante" value={`${tasksToday.length} / ${tasksOverdue.length}`} tone={tasksOverdue.length ? "red" : undefined} />
        <Stat label="Comenzi întârziate" value={lateOrders.length} tone={lateOrders.length ? "red" : "green"} />
      </div>

      <DashboardFinance profile={profile} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Lead-uri care așteaptă primul contact" action={<Link className={btnSmall} href="/lead-uri">Toate</Link>}>
          {waiting.length === 0 ? (
            <Empty text="Niciun lead nu așteaptă." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {waiting.slice(0, 8).map((l) => {
                const days = daysBetween(String(l.created_at).slice(0, 10), today);
                return (
                  <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/lead-uri/${l.id}`} className="font-medium text-indigo-700 hover:underline">{l.store_name}</Link>
                    <span className={days >= 1 ? "text-red-600" : "text-slate-500"}>{days === 0 ? "azi" : `de ${days} zile`}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Taskuri pentru azi și restante" action={<Link className={btnSmall} href="/taskuri">Toate</Link>}>
          {tasksToday.length + tasksOverdue.length === 0 ? (
            <Empty text="Nu ai taskuri scadente." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...tasksOverdue, ...tasksToday].slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{t.title}</div>
                    <div className="text-xs text-slate-500">{nameOf(t)}</div>
                  </div>
                  <div className="text-right">
                    <div className={t.due_date < today ? "text-xs text-red-600" : "text-xs text-slate-500"}>{fmtDate(t.due_date)}</div>
                    <Badge value={t.priority}>{PRIORITY[t.priority]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Clienți cu risc">
          {atRisk.length === 0 ? (
            <Empty text="Niciun client cu risc acum." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {atRisk.slice(0, 8).map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <Link href={`/clienti/${c.id}`} className="font-medium text-indigo-700 hover:underline">{c.name}</Link>
                  <div className="text-xs text-slate-500">{c.reasons.join(" · ")}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Promisiuni nerezolvate" action={overduePromises.length ? <Badge tone="red">{overduePromises.length} depășite</Badge> : undefined}>
          {promises.length === 0 ? (
            <Empty text="Nicio promisiune deschisă." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {promises.slice(0, 8).map((p) => (
                <li key={p.id} className="py-2 text-sm">
                  <div className="font-medium text-slate-900">{p.promise}</div>
                  <div className="text-xs text-slate-500">
                    {nameOf(p)} · termen {fmtDate(p.promise_due)}
                    {p.promise_due && p.promise_due < today ? <span className="ml-1 text-red-600">(depășit)</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Comenzi în lucru" className="mt-6" action={<Link className={btnSmall} href="/comenzi">Toate</Link>}>
        {openOrders.length === 0 ? (
          <Empty text="Nicio comandă deschisă." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  <th className={th}>Nr.</th>
                  <th className={th}>Client</th>
                  <th className={th}>Status</th>
                  <th className={th}>Termen</th>
                  <th className={th}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {openOrders.slice(0, 10).map((o) => (
                  <tr key={o.id}>
                    <td className={td}><Link className="text-indigo-700 hover:underline" href={`/comenzi/${o.id}`}>#{o.number}</Link></td>
                    <td className={td}>{o.client_name}</td>
                    <td className={td}><Badge value={o.status}>{ORDER_STATUS[o.status]}</Badge></td>
                    <td className={`${td} ${o.deadline && o.deadline < today ? "text-red-600" : ""}`}>{fmtDate(o.deadline)}</td>
                    <td className={td}>{fmtRON(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-6 text-xs text-slate-400">Etape lead: {Object.values(LEAD_STAGES).join(" → ")}</p>
    </>
  );
}
