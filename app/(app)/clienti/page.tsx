import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStaff, requireActive } from "@/lib/session";
import { Badge, Empty, Field, Flash, PageHeader, Pagination, Select, btnCls, btnGhost, inputCls, td, th } from "@/components/ui";
import { createClientAction } from "@/app/actions";
import { fmtDate, fmtRON } from "@/lib/format";
import { CLIENT_STATUS, PAGE_SIZE, RISK, SOURCES } from "@/lib/constants";
import type { Row, SP } from "@/lib/types";

export default async function ClientsPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  const sp = await searchParams;
  const supabase = await createClient();
  const write = isStaff(profile);

  const page = Math.max(1, Number(sp.pagina) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const qText = (sp.q ?? "").replace(/[%_\\,()]/g, " ").trim();
  const archived = sp.arhiva === "1";

  let query = supabase
    .from("clients")
    .select("id, name, status, risk_level, owner_id, category, source", { count: "exact" })
    .eq("archived", archived)
    .order("name", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);
  if (qText) query = query.ilike("name", `%${qText}%`);
  if (sp.status && CLIENT_STATUS[sp.status]) query = query.eq("status", sp.status);

  const [listR, usersR] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name").eq("active", true).neq("role", "viewer"),
  ]);
  const clients: Row[] = listR.data ?? [];
  const users: Row[] = usersR.data ?? [];
  const ids = clients.map((c) => c.id);
  const statsR = ids.length ? await supabase.from("client_stats").select("*").in("client_id", ids) : { data: [] as Row[] };
  const stats = new Map<string, Row>((statsR.data ?? []).map((s: Row) => [s.client_id, s]));
  const owner = (id: string | null) => users.find((u) => u.id === id)?.full_name ?? "—";

  const params = new URLSearchParams();
  if (qText) params.set("q", qText);
  if (sp.status) params.set("status", sp.status);
  if (archived) params.set("arhiva", "1");
  const base = `/clienti${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <>
      <PageHeader
        title="Clienți"
        subtitle={archived ? "Clienți arhivați" : "Toți clienții activi și potențiali"}
        actions={
          <>
            <Link className={btnGhost} href={archived ? "/clienti" : "/clienti?arhiva=1"}>{archived ? "Arată activi" : "Arată arhiva"}</Link>
            {write ? <a className={btnGhost} href="/clienti/export">Export CSV</a> : null}
          </>
        }
      />
      <Flash sp={sp} />

      <form className="mb-4 flex flex-wrap items-end gap-3" action="/clienti">
        <Field label="Caută după nume" className="w-64">
          <input name="q" defaultValue={qText} className={inputCls} placeholder="Nume magazin…" />
        </Field>
        <Field label="Status" className="w-48">
          <Select name="status" options={CLIENT_STATUS} defaultValue={sp.status ?? ""} empty="Toate" />
        </Field>
        {archived ? <input type="hidden" name="arhiva" value="1" /> : null}
        <button className={btnCls}>Filtrează</button>
      </form>

      {write ? (
        <details className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">+ Client nou</summary>
          <form action={createClientAction} className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="back" value="/clienti" />
            <Field label="Nume magazin / brand *"><input name="name" required className={inputCls} /></Field>
            <Field label="Website"><input name="website" className={inputCls} /></Field>
            <Field label="Categorie produse"><input name="category" className={inputCls} /></Field>
            <Field label="Platformă eCommerce"><input name="platform" className={inputCls} placeholder="Shopify, WooCommerce…" /></Field>
            <Field label="Status"><Select name="status" options={CLIENT_STATUS} defaultValue="test" /></Field>
            <Field label="Sursă"><Select name="source" options={SOURCES} defaultValue="email" /></Field>
            <Field label="Account manager">
              <select name="owner_id" className={inputCls} defaultValue="">
                <option value="">Eu</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3"><button className={btnCls}>Creează client</button></div>
          </form>
        </details>
      ) : null}

      {clients.length === 0 ? (
        <Empty text={qText || sp.status ? "Niciun client nu corespunde filtrelor." : "Nu există clienți încă. Un lead devine client când îl muți în etapa „Client”, sau poți crea unul manual."} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Client</th>
                <th className={th}>Status</th>
                <th className={th}>Responsabil</th>
                <th className={th}>Comenzi</th>
                <th className={th}>Venit</th>
                <th className={th}>Ultima comandă</th>
                <th className={th}>Ultima discuție</th>
                <th className={th}>Risc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => {
                const s = stats.get(c.id);
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className={td}><Link href={`/clienti/${c.id}`} className="font-medium text-indigo-700 hover:underline">{c.name}</Link></td>
                    <td className={td}><Badge value={c.status}>{CLIENT_STATUS[c.status]}</Badge></td>
                    <td className={td}>{owner(c.owner_id)}</td>
                    <td className={td}>{s?.orders_count ?? 0}</td>
                    <td className={td}>{fmtRON(s?.revenue_total)}</td>
                    <td className={td}>{fmtDate(s?.last_order_date)}</td>
                    <td className={td}>{fmtDate(s?.last_interaction_at)}</td>
                    <td className={td}><Badge value={c.risk_level}>{RISK[c.risk_level]}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={listR.count ?? 0} base={base} />
    </>
  );
}
