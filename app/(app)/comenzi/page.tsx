import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canRead, hasFinance, isAdmin, isStaff, requireActive } from "@/lib/session";
import { Badge, Empty, Field, Flash, PageHeader, Pagination, Select, btnCls, btnGhost, inputCls, td, th } from "@/components/ui";
import { createOrder } from "@/app/actions";
import { deleteOrder } from "@/app/delete-order";
import { markOrderPaid } from "@/app/stage2-actions";
import { PAY_METHOD } from "@/lib/finance";
import { fmtDate, fmtRON, todayISO } from "@/lib/format";
import { FINANCIAL, ORDER_STATUS, PACKAGES, PAGE_SIZE } from "@/lib/constants";
import type { Row, SP } from "@/lib/types";

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  const sp = await searchParams;
  const supabase = await createClient();
  const write = isStaff(profile);
  const money = canRead(profile);
  const canPay = hasFinance(profile);
  const admin = isAdmin(profile);
  const today = todayISO();

  const page = Math.max(1, Number(sp.pagina) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const qText = (sp.q ?? "").replace(/[%_\\,()]/g, " ").trim();

  let query = supabase
    .from("orders")
    .select("id, number, client_name, order_date, status, financial_status, deadline, creatives_count, total, editor_id", { count: "exact" })
    .order("order_date", { ascending: false })
    .order("number", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (qText) query = query.ilike("client_name", `%${qText}%`);
  if (sp.status && ORDER_STATUS[sp.status]) query = query.eq("status", sp.status);
  if (sp.editor) query = query.eq("editor_id", sp.editor);
  if (sp.intarziate === "1") query = query.lt("deadline", today).not("status", "in", "(livrata,anulata)");
  if (sp.neincasate === "1") query = query.neq("financial_status", "incasata").neq("status", "anulata");

  const [listR, usersR, clientsR] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name").eq("active", true).neq("role", "viewer"),
    write ? supabase.from("clients").select("id, name").eq("archived", false).order("name").limit(1000) : Promise.resolve({ data: [] as Row[] }),
  ]);
  const orders: Row[] = listR.data ?? [];
  const users: Row[] = usersR.data ?? [];
  const clients: Row[] = clientsR.data ?? [];
  const editorName = (id: string | null) => users.find((u) => u.id === id)?.full_name ?? "—";

  const params = new URLSearchParams();
  if (qText) params.set("q", qText);
  if (sp.status) params.set("status", sp.status);
  if (sp.editor) params.set("editor", sp.editor);
  if (sp.intarziate === "1") params.set("intarziate", "1");
  if (sp.neincasate === "1") params.set("neincasate", "1");
  const base = `/comenzi${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <>
      <PageHeader
        title={profile.role === "editor" ? "Comenzile mele" : "Comenzi"}
        subtitle={profile.role === "editor" ? "Doar comenzile care ți-au fost alocate." : "Comenzi comerciale și creativele din ele."}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={sp.neincasate === "1" ? "/comenzi" : "/comenzi?neincasate=1"} className={btnGhost}>
              {sp.neincasate === "1" ? "Arată toate" : "Doar neîncasate"}
            </Link>
            <Link href={sp.intarziate === "1" ? "/comenzi" : "/comenzi?intarziate=1"} className={btnGhost}>
              {sp.intarziate === "1" ? "Arată toate" : "Doar întârziate"}
            </Link>
          </div>
        }
      />
      <Flash sp={sp} />

      <form action="/comenzi" className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Client" className="w-56"><input name="q" defaultValue={qText} className={inputCls} placeholder="Nume client…" /></Field>
        <Field label="Status" className="w-48"><Select name="status" options={ORDER_STATUS} defaultValue={sp.status ?? ""} empty="Toate" /></Field>
        {profile.role !== "editor" ? (
          <Field label="Editor" className="w-48">
            <select name="editor" defaultValue={sp.editor ?? ""} className={inputCls}>
              <option value="">Toți</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </Field>
        ) : null}
        {sp.intarziate === "1" ? <input type="hidden" name="intarziate" value="1" /> : null}
        <button className={btnCls}>Filtrează</button>
      </form>

      {write ? (
        <details id="nou" open={Boolean(sp.client) || sp.nou === "1"} className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">+ Comandă nouă</summary>
          {clients.length === 0 ? (
            <div className="border-t border-slate-100 p-4"><Empty text="Creează mai întâi un client." /></div>
          ) : (
            <form action={createOrder} className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <input type="hidden" name="back" value="/comenzi" />
              <Field label="Client *">
                <select name="client_id" required defaultValue={sp.client ?? ""} className={inputCls}>
                  <option value="" disabled>Alege clientul…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Pachet"><Select name="package" options={PACKAGES} defaultValue="standard" /></Field>
              <Field label="Număr de creative"><input name="creatives_count" type="number" min={0} defaultValue={1} className={inputCls} /></Field>
              <Field label="Preț convenit (RON)" hint="Lasă 0 pentru calcul automat: Standard 20 RON (19 la 50+), Plus 30, Performanță 35, Ofertă de start (6+ reclame: 2 la 10 RON, restul 20). Pachetele personalizate se negociază."><input name="price_agreed" inputMode="decimal" defaultValue="0" className={inputCls} /></Field>
              <Field label="Discount (RON)"><input name="discount" inputMode="decimal" defaultValue="0" className={inputCls} /></Field>
              <Field label="Termen de livrare"><input name="deadline" type="date" className={inputCls} /></Field>
              <Field label="Editor">
                <select name="editor_id" defaultValue="" className={inputCls}>
                  <option value="">Nealocat</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </Field>
              <Field label="Link brief"><input name="brief_url" className={inputCls} placeholder="https://…" /></Field>
              <Field label="Link asseturi"><input name="assets_url" className={inputCls} placeholder="https://…" /></Field>
              <Field label="Observații" className="sm:col-span-2 lg:col-span-3"><textarea name="notes" rows={2} className={inputCls} /></Field>
              <div className="sm:col-span-2 lg:col-span-3"><button className={btnCls}>Creează comanda</button></div>
            </form>
          )}
        </details>
      ) : null}

      {orders.length === 0 ? (
        <Empty text={qText || sp.status || sp.editor || sp.intarziate ? "Nicio comandă nu corespunde filtrelor." : "Nu există comenzi încă."} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Nr.</th>
                <th className={th}>Client</th>
                <th className={th}>Data</th>
                <th className={th}>Status</th>
                <th className={th}>Editor</th>
                <th className={th}>Termen</th>
                <th className={th}>Creative</th>
                {money ? <th className={th}>Total</th> : null}
                {money ? <th className={th}>Financiar</th> : null}
                {canPay ? <th className={th}>Încasare</th> : null}
                {admin ? <th className={th}></th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => {
                const late = o.deadline && o.deadline < today && !["livrata", "anulata"].includes(o.status);
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className={td}><Link className="font-medium text-indigo-700 hover:underline" href={`/comenzi/${o.id}`}>#{o.number}</Link></td>
                    <td className={td}>{o.client_name}</td>
                    <td className={td}>{fmtDate(o.order_date)}</td>
                    <td className={td}><Badge value={o.status}>{ORDER_STATUS[o.status]}</Badge></td>
                    <td className={td}>{editorName(o.editor_id)}</td>
                    <td className={`${td} ${late ? "font-medium text-red-600" : ""}`}>{fmtDate(o.deadline)}{late ? " · întârziată" : ""}</td>
                    <td className={td}>{o.creatives_count}</td>
                    {money ? <td className={td}>{fmtRON(o.total)}</td> : null}
                    {money ? <td className={td}><Badge value={o.financial_status}>{FINANCIAL[o.financial_status]}</Badge></td> : null}
                    {canPay ? (
                      <td className={td}>
                        {o.financial_status === "incasata" || o.status === "anulata" ? (
                          <span className="text-xs text-emerald-600">{o.status === "anulata" ? "—" : "✓ încasat"}</span>
                        ) : (
                          <form action={markOrderPaid} className="flex items-center gap-1">
                            <input type="hidden" name="back" value={base} />
                            <input type="hidden" name="order_id" value={o.id} />
                            <select name="method" defaultValue="ramburs" className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs">
                              {Object.entries(PAY_METHOD).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                            </select>
                            <button className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Încasat</button>
                          </form>
                        )}
                      </td>
                    ) : null}
                    {admin ? (
                      <td className={td}>
                        <details className="relative">
                          <summary className="cursor-pointer list-none rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50">Șterge</summary>
                          <form action={deleteOrder} className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-red-200 bg-white p-3 shadow-lg">
                            <input type="hidden" name="id" value={o.id} />
                            <input type="hidden" name="confirm" value="on" />
                            <p className="mb-2 text-xs text-slate-600">Ștergi definitiv comanda #{o.number} ({o.client_name}), cu creativele și facturile ei?</p>
                            <button className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700">Da, șterge</button>
                          </form>
                        </details>
                      </td>
                    ) : null}
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
