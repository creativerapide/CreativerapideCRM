import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasFinance, type Profile } from "@/lib/session";
import { Card, Stat, btnSmall } from "@/components/ui";
import { fmtRON, monthStartISO, nextMonthStartISO, todayISO } from "@/lib/format";
import { computeRetention, pct, sum } from "@/lib/finance";
import type { Row } from "@/lib/types";

/** Blocuri suplimentare pentru panou: finanțe (doar cu drept financiar) și retenție. */
export default async function DashboardFinance({ profile }: { profile: Profile }) {
  const supabase = await createClient();
  const today = todayISO();
  const from = monthStartISO();
  const to = nextMonthStartISO();
  const finance = hasFinance(profile);

  const [ordersR, invR, payR, costR, openR] = await Promise.all([
    supabase.from("orders").select("client_id, order_date").neq("status", "anulata"),
    finance ? supabase.from("invoices").select("amount").neq("status", "anulata").gte("issue_date", from).lt("issue_date", to) : Promise.resolve({ data: [] as Row[] }),
    finance ? supabase.from("payments").select("amount").gte("paid_on", from).lt("paid_on", to) : Promise.resolve({ data: [] as Row[] }),
    finance ? supabase.from("costs").select("amount").gte("incurred_on", from).lt("incurred_on", to) : Promise.resolve({ data: [] as Row[] }),
    finance ? supabase.from("invoices").select("amount, due_date, payments(amount)").in("status", ["emisa", "partial_incasata"]) : Promise.resolve({ data: [] as Row[] }),
  ]);

  const ret = computeRetention((ordersR.data ?? []) as { client_id: string; order_date: string }[], today);
  const invoiced = sum(invR.data, "amount");
  const collected = sum(payR.data, "amount");
  const costs = sum(costR.data, "amount");
  const open: Row[] = openR.data ?? [];
  const overdue = open
    .filter((i) => i.due_date && i.due_date < today)
    .reduce((s, i) => s + Number(i.amount) - sum(i.payments, "amount"), 0);

  return (
    <div className="mb-6 space-y-6">
      {finance ? (
        <Card title="Finanțe luna aceasta" action={<Link className={btnSmall} href="/finante">Detalii</Link>}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Facturat" value={fmtRON(invoiced)} />
            <Stat label="Încasat" value={fmtRON(collected)} tone="green" />
            <Stat label="Creanțe restante" value={fmtRON(overdue)} tone={overdue > 0 ? "red" : undefined} />
            <Stat label="Costuri directe" value={fmtRON(costs)} />
            <Stat label="Marjă estimată" value={fmtRON(invoiced - costs)} hint="nu este profit contabil" tone={invoiced - costs < 0 ? "red" : undefined} />
          </div>
        </Card>
      ) : null}
      <Card title="Retenție clienți" action={<Link className={btnSmall} href="/rapoarte">Rapoarte</Link>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="La 30 de zile" value={pct(ret.r30.retained, ret.r30.eligible)} hint={`${ret.r30.retained} din ${ret.r30.eligible} clienți`} />
          <Stat label="La 60 de zile" value={pct(ret.r60.retained, ret.r60.eligible)} hint={`${ret.r60.retained} din ${ret.r60.eligible} clienți`} />
          <Stat label="La 90 de zile" value={pct(ret.r90.retained, ret.r90.eligible)} hint={`${ret.r90.retained} din ${ret.r90.eligible} clienți`} />
          <Stat label="Au revenit după pauză" value={ret.returned} hint="comandă după ≥ 30 de zile" />
        </div>
      </Card>
    </div>
  );
}
