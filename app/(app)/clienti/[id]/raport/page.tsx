import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasFinance, requireActive } from "@/lib/session";
import { Badge, Card, Empty, PageHeader, Stat, btnGhost, btnCls, td, th } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import { fmtDate, fmtRON } from "@/lib/format";
import { CHANNELS, ORDER_STATUS } from "@/lib/constants";
import { monthLabel, monthParam, monthRange, shiftMonth, sum } from "@/lib/finance";
import type { Row, SP } from "@/lib/types";

export default async function ClientMonthlyReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const profile = await requireActive();
  if (profile.role === "editor") redirect("/comenzi");
  const { id } = await params;
  const sp = await searchParams;
  const luna = monthParam(sp.luna);
  const { from, to } = monthRange(luna);
  const supabase = await createClient();
  const finance = hasFinance(profile);

  const clientR = await supabase.from("clients").select("id, name, website, status").eq("id", id).maybeSingle();
  const client: Row | null = clientR.data;
  if (!client) notFound();

  const [ordersR, interR, promisesR, invR, payR] = await Promise.all([
    supabase.from("orders").select("id, number, order_date, status, deadline, delivered_at, creatives_count, total").eq("client_id", id).gte("order_date", from).lt("order_date", to).order("order_date"),
    supabase.from("interactions").select("id, occurred_at, channel, summary").eq("client_id", id).eq("cancelled", false).gte("occurred_at", from).lt("occurred_at", to).order("occurred_at"),
    supabase.from("interactions").select("id, promise, promise_due").eq("client_id", id).eq("cancelled", false).eq("promise_done", false).not("promise", "is", null),
    finance ? supabase.from("invoices").select("amount").eq("client_id", id).neq("status", "anulata").gte("issue_date", from).lt("issue_date", to) : Promise.resolve({ data: [] as Row[] }),
    finance ? supabase.from("payments").select("amount, invoices!inner(client_id)").eq("invoices.client_id", id).gte("paid_on", from).lt("paid_on", to) : Promise.resolve({ data: [] as Row[] }),
  ]);
  const orders: Row[] = ordersR.data ?? [];
  const orderIds = orders.map((o) => o.id);
  const creativesR = orderIds.length
    ? await supabase.from("creatives").select("order_id, status, revisions").in("order_id", orderIds)
    : { data: [] as Row[] };
  const creatives: Row[] = creativesR.data ?? [];
  const interactions: Row[] = interR.data ?? [];
  const promises: Row[] = promisesR.data ?? [];

  const delivered = creatives.filter((c) => c.status === "livrata").length;
  const active = creatives.filter((c) => !["livrata", "anulata"].includes(c.status)).length;
  const revisions = sum(creatives, "revisions");
  const late = orders.filter((o) => {
    const doneDay = o.delivered_at ? String(o.delivered_at).slice(0, 10) : null;
    if (!o.deadline) return false;
    return doneDay ? doneDay > o.deadline : !["livrata", "anulata"].includes(o.status) && o.deadline < to;
  });
  const orderedTotal = sum(orders, "total");

  return (
    <>
      <PageHeader
        title={`Raport lunar · ${client.name}`}
        subtitle={`Luna ${monthLabel(luna)}`}
        actions={
          <>
            <Link className={`${btnGhost} print:hidden`} href={`/clienti/${id}/raport?luna=${shiftMonth(luna, -1)}`}>← Luna precedentă</Link>
            <Link className={`${btnGhost} print:hidden`} href={`/clienti/${id}/raport?luna=${shiftMonth(luna, 1)}`}>Luna următoare →</Link>
            <Link className={`${btnGhost} print:hidden`} href={`/clienti/${id}`}>Fișa clientului</Link>
            <PrintButton className={`${btnCls} print:hidden`} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Comenzi în lună" value={orders.length} hint={`${fmtRON(orderedTotal)} valoare comenzi`} />
        <Stat label="Creative livrate" value={delivered} hint={`${active} încă în lucru`} />
        <Stat label="Revizii" value={revisions} />
        <Stat label="Comenzi cu întârziere" value={late.length} tone={late.length ? "red" : "green"} />
      </div>

      {finance ? (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Facturat în lună" value={fmtRON(sum(invR.data, "amount"))} />
          <Stat label="Încasat în lună" value={fmtRON(sum(payR.data, "amount"))} tone="green" />
          <Stat label="Interacțiuni" value={interactions.length} />
        </div>
      ) : null}

      <Card title="Comenzi" className="mb-6">
        {orders.length === 0 ? <Empty text="Nicio comandă în această lună." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead><tr><th className={th}>Nr.</th><th className={th}>Data</th><th className={th}>Status</th><th className={th}>Creative</th><th className={th}>Termen</th><th className={th}>Livrată</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className={td}>#{o.number}</td>
                    <td className={td}>{fmtDate(o.order_date)}</td>
                    <td className={td}><Badge value={o.status}>{ORDER_STATUS[o.status]}</Badge></td>
                    <td className={td}>{o.creatives_count}</td>
                    <td className={td}>{fmtDate(o.deadline)}</td>
                    <td className={td}>{fmtDate(o.delivered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Discuții în lună">
          {interactions.length === 0 ? <Empty text="Nicio discuție înregistrată." /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {interactions.map((i) => (
                <li key={i.id} className="py-2">
                  <div className="text-xs text-slate-500">{fmtDate(i.occurred_at)} · {CHANNELS[i.channel]}</div>
                  <div className="text-slate-800">{i.summary}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Promisiuni deschise">
          {promises.length === 0 ? <Empty text="Nicio promisiune deschisă." /> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {promises.map((p) => (
                <li key={p.id} className="py-2">
                  <div className="text-slate-800">{p.promise}</div>
                  <div className="text-xs text-slate-500">termen {fmtDate(p.promise_due)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
