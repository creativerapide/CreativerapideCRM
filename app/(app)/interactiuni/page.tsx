import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStaff, requireActive } from "@/lib/session";
import { redirect } from "next/navigation";
import { Badge, Card, Empty, Field, Flash, PageHeader, Pagination, Select, btnCls, btnSmall, inputCls } from "@/components/ui";
import { cancelInteraction, logInteraction, togglePromise } from "@/app/actions";
import { fmtDate, fmtDateTime, todayISO } from "@/lib/format";
import { CHANNELS, PAGE_SIZE } from "@/lib/constants";
import { one, type Row, type SP } from "@/lib/types";

export default async function InteractionsPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  if (profile.role === "editor") redirect("/comenzi");
  const sp = await searchParams;
  const supabase = await createClient();
  const write = isStaff(profile);
  const today = todayISO();

  const page = Math.max(1, Number(sp.pagina) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("interactions")
    .select("*, profiles(full_name), clients(id, name), leads(id, store_name)", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (sp.canal && CHANNELS[sp.canal]) query = query.eq("channel", sp.canal);

  const [listR, clientsR, leadsR] = await Promise.all([
    query,
    supabase.from("clients").select("id, name").eq("archived", false).order("name").limit(1000),
    supabase.from("leads").select("id, store_name").eq("archived", false).not("stage", "in", "(client,pierdut)").order("store_name").limit(1000),
  ]);
  const items: Row[] = listR.data ?? [];
  const clients: Row[] = clientsR.data ?? [];
  const leads: Row[] = leadsR.data ?? [];
  const back = "/interactiuni";
  const base = sp.canal ? `/interactiuni?canal=${sp.canal}` : "/interactiuni";

  return (
    <>
      <PageHeader title="Interacțiuni" subtitle="Jurnalul discuțiilor cu clienții și lead-urile (WhatsApp, apeluri, emailuri)." />
      <Flash sp={sp} />

      {write ? (
        <Card title="Înregistrare rapidă" className="mb-6">
          <form action={logInteraction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="back" value={back} />
            <Field label="Client">
              <select name="client_id" defaultValue="" className={inputCls}>
                <option value="">— alege —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="sau Lead">
              <select name="lead_id" defaultValue="" className={inputCls}>
                <option value="">— alege —</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.store_name}</option>)}
              </select>
            </Field>
            <Field label="Canal"><Select name="channel" options={CHANNELS} defaultValue="whatsapp" /></Field>
            <Field label="Tip"><input name="type" className={inputCls} placeholder="ex. feedback, ofertă" /></Field>
            <Field label="Rezumat *" className="sm:col-span-2 lg:col-span-4"><textarea name="summary" required rows={2} className={inputCls} /></Field>
            <Field label="Problemă"><input name="issue" className={inputCls} /></Field>
            <Field label="Promisiune făcută"><input name="promise" className={inputCls} /></Field>
            <Field label="Termen promisiune"><input name="promise_due" type="date" className={inputCls} /></Field>
            <Field label="Rezultat"><input name="outcome" className={inputCls} /></Field>
            <Field label="Următorul pas"><input name="next_step" className={inputCls} /></Field>
            <Field label="Data următorului pas"><input name="next_step_at" type="date" className={inputCls} /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 lg:col-span-2">
              <input type="checkbox" name="make_task" /> Creează task pentru următorul pas
            </label>
            <div className="sm:col-span-2 lg:col-span-4"><button className={btnCls}>Salvează</button></div>
          </form>
        </Card>
      ) : null}

      <form action="/interactiuni" className="mb-4 flex items-end gap-3">
        <Field label="Canal" className="w-48"><Select name="canal" options={CHANNELS} defaultValue={sp.canal ?? ""} empty="Toate" /></Field>
        <button className={btnCls}>Filtrează</button>
      </form>

      <Card title="Cronologie">
        {items.length === 0 ? (
          <Empty text="Nicio interacțiune înregistrată încă." />
        ) : (
          <ul className="space-y-5">
            {items.map((i) => {
              const target = one(i.clients);
              const lead = one(i.leads);
              const open = i.promise && !i.promise_done && !i.cancelled;
              return (
                <li key={i.id} className={`text-sm ${i.cancelled ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{fmtDateTime(i.occurred_at)}</span>
                    <Badge tone="slate">{CHANNELS[i.channel]}</Badge>
                    <span>{one(i.profiles)?.full_name ?? ""}</span>
                    {i.cancelled ? <Badge tone="red">Anulată</Badge> : null}
                  </div>
                  <div className="mt-1 font-medium">
                    {target ? <Link className="text-indigo-700 hover:underline" href={`/clienti/${target.id}`}>{target.name}</Link> : null}
                    {!target && lead ? <Link className="text-indigo-700 hover:underline" href={`/lead-uri/${lead.id}`}>{lead.store_name} <span className="font-normal text-slate-500">(lead)</span></Link> : null}
                    {i.type ? <span className="ml-2 font-normal text-slate-500">· {i.type}</span> : null}
                  </div>
                  <p className="whitespace-pre-wrap text-slate-800">{i.summary}</p>
                  {i.issue ? <p className="text-xs text-red-700">Problemă: {i.issue}</p> : null}
                  {i.promise ? (
                    <p className={`text-xs ${i.promise_done ? "text-emerald-700" : i.promise_due && i.promise_due < today ? "text-red-700" : "text-amber-700"}`}>
                      Promisiune: {i.promise} (termen {fmtDate(i.promise_due)}){i.promise_done ? " ✓ îndeplinită" : ""}
                    </p>
                  ) : null}
                  {i.next_step ? <p className="text-xs text-slate-500">Pas următor: {i.next_step} ({fmtDate(i.next_step_at)})</p> : null}
                  {write && !i.cancelled ? (
                    <div className="mt-1 flex gap-2">
                      {open || (i.promise && i.promise_done) ? (
                        <form action={togglePromise}>
                          <input type="hidden" name="back" value={base} />
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="done" value={i.promise_done ? "0" : "1"} />
                          <button className={btnSmall}>{i.promise_done ? "Redeschide promisiunea" : "Marchează îndeplinită"}</button>
                        </form>
                      ) : null}
                      <form action={cancelInteraction}>
                        <input type="hidden" name="back" value={base} />
                        <input type="hidden" name="id" value={i.id} />
                        <button className={btnSmall}>Anulează înregistrarea</button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Pagination page={page} total={listR.count ?? 0} base={base} />
    </>
  );
}
