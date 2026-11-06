import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff, requireActive } from "@/lib/session";
import { Badge, Card, Empty, Field, Flash, PageHeader, Select, Stat, btnCls, btnGhost, btnSmall, inputCls, td, th } from "@/components/ui";
import { addContact, addNote, cancelInteraction, createTask, logInteraction, togglePromise, updateClientAction } from "@/app/actions";
import { fmtDate, fmtDateTime, fmtRON } from "@/lib/format";
import { CHANNELS, CLIENT_STATUS, ORDER_STATUS, PRIORITY, RISK, SATISFACTION, SOURCES } from "@/lib/constants";
import { WhatsAppCard } from "@/components/WhatsAppCard";
import { CLIENT_TEMPLATES, waNumber } from "@/lib/whatsapp";
import type { Row, SP } from "@/lib/types";

export default async function ClientDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const profile = await requireActive();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const write = isStaff(profile);

  const [clientR, statsR, contactsR, notesR, ordersR, interR, tasksR, usersR] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("client_stats").select("*").eq("client_id", id).maybeSingle(),
    supabase.from("contacts").select("*").eq("client_id", id).order("is_primary", { ascending: false }),
    supabase.from("client_notes").select("*, profiles(full_name)").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("orders").select("id, number, order_date, status, deadline, total, creatives_count, financial_status").eq("client_id", id).order("order_date", { ascending: false }),
    supabase.from("interactions").select("*, profiles(full_name)").eq("client_id", id).order("occurred_at", { ascending: false }),
    supabase.from("tasks").select("id, title, due_date, priority, status").eq("client_id", id).in("status", ["de_facut", "in_lucru"]).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("profiles").select("id, full_name").eq("active", true).neq("role", "viewer"),
  ]);
  const c: Row | null = clientR.data;
  if (!c) notFound();
  const s: Row = statsR.data ?? {};
  const contacts: Row[] = contactsR.data ?? [];
  const notes: Row[] = notesR.data ?? [];
  const orders: Row[] = ordersR.data ?? [];
  const interactions: Row[] = interR.data ?? [];
  const tasks: Row[] = tasksR.data ?? [];
  const users: Row[] = usersR.data ?? [];
  const back = `/clienti/${id}`;
  const dis = !write;
  const mainContact = contacts.find((p) => p.phone && p.is_primary) ?? contacts.find((p) => p.phone);

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={c.website ?? undefined}
        actions={
          <>
            <Badge value={c.status}>{CLIENT_STATUS[c.status]}</Badge>
            <Badge value={c.risk_level}>Risc {RISK[c.risk_level].toLowerCase()}</Badge>
            {c.archived ? <Badge tone="slate">Arhivat</Badge> : null}
            <Link href="/clienti" className={btnGhost}>← Clienți</Link>
            {write ? <Link href={`/comenzi?client=${id}`} className={btnCls}>+ Comandă nouă</Link> : null}
          </>
        }
      />
      <Flash sp={sp} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Comenzi" value={s.orders_count ?? 0} hint={`${s.creatives_count ?? 0} creative`} />
        <Stat label="Venit din comenzi" value={fmtRON(s.revenue_total)} hint="Nu include încasările confirmate" />
        <Stat label="Prima / ultima comandă" value={<span className="text-base">{fmtDate(s.first_order_date)} / {fmtDate(s.last_order_date)}</span>} />
        <Stat label="Ultima discuție" value={<span className="text-base">{fmtDate(s.last_interaction_at)}</span>} hint={s.next_step ? `Pas: ${s.next_step} (${fmtDate(s.next_step_at)})` : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Detalii client">
          <form action={updateClientAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="id" value={id} />
            <Field label="Nume *"><input name="name" defaultValue={c.name} required disabled={dis} className={inputCls} /></Field>
            <Field label="Website"><input name="website" defaultValue={c.website ?? ""} disabled={dis} className={inputCls} /></Field>
            <Field label="Categorie produse"><input name="category" defaultValue={c.category ?? ""} disabled={dis} className={inputCls} /></Field>
            <Field label="Platformă eCommerce"><input name="platform" defaultValue={c.platform ?? ""} disabled={dis} className={inputCls} /></Field>
            <Field label="Model de business"><input name="business_model" defaultValue={c.business_model ?? ""} disabled={dis} className={inputCls} /></Field>
            <Field label="Status"><Select name="status" options={CLIENT_STATUS} defaultValue={c.status} /></Field>
            <Field label="Sursă"><Select name="source" options={SOURCES} defaultValue={c.source ?? "email"} /></Field>
            <Field label="Data achiziției"><input name="acquired_at" type="date" defaultValue={c.acquired_at ?? ""} disabled={dis} className={inputCls} /></Field>
            <Field label="Account manager">
              <select name="owner_id" defaultValue={c.owner_id ?? ""} disabled={dis} className={inputCls}>
                <option value="">—</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </Field>
            <Field label="Satisfacție"><Select name="satisfaction" options={SATISFACTION} defaultValue={c.satisfaction} /></Field>
            <Field label="Nivel de risc"><Select name="risk_level" options={RISK} defaultValue={c.risk_level} /></Field>
            <Field label="Motiv risc"><input name="risk_reason" defaultValue={c.risk_reason ?? ""} disabled={dis} className={inputCls} /></Field>
            <Field label="Motiv pierdere (obligatoriu la „Pierdut”)" className="sm:col-span-2">
              <input name="lost_reason" defaultValue={c.lost_reason ?? ""} disabled={dis} className={inputCls} />
            </Field>
            <Field label="Preferințe creative" className="sm:col-span-2"><textarea name="preferences" rows={2} defaultValue={c.preferences ?? ""} disabled={dis} className={inputCls} /></Field>
            <Field label="Instrucțiuni recurente" className="sm:col-span-2"><textarea name="recurring_instructions" rows={2} defaultValue={c.recurring_instructions ?? ""} disabled={dis} className={inputCls} /></Field>
            <Field label="Link către asseturi" className="sm:col-span-2"><input name="assets_url" defaultValue={c.assets_url ?? ""} disabled={dis} className={inputCls} placeholder="https://…" /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" name="archived" defaultChecked={c.archived} disabled={dis} /> Arhivat (ascuns din lista principală)
            </label>
            {write ? <div className="sm:col-span-2"><button className={btnCls}>Salvează</button></div> : null}
          </form>
        </Card>

        <div className="space-y-6">
          <WhatsAppCard phone={mainContact?.phone} nume={mainContact?.name} magazin={c.name} templates={CLIENT_TEMPLATES} back={back} clientId={id} write={write} />
          <Card title="Contacte">
            {contacts.length === 0 ? <Empty text="Niciun contact." /> : (
              <ul className="divide-y divide-slate-100">
                {contacts.map((p) => (
                  <li key={p.id} className="py-2 text-sm">
                    <div className="font-medium text-slate-900">{p.name}{p.role ? ` · ${p.role}` : ""}{p.is_primary ? " ★" : ""}</div>
                    <div className="text-xs text-slate-500">
                      {[p.email, p.phone, p.preferred_channel ? CHANNELS[p.preferred_channel] : null].filter(Boolean).join(" · ")}
                      {waNumber(p.phone) ? <> · <a href={`https://wa.me/${waNumber(p.phone)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline">WhatsApp</a></> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {write ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-indigo-700">+ Adaugă contact</summary>
                <form action={addContact} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="client_id" value={id} />
                  <Field label="Nume *"><input name="name" required className={inputCls} /></Field>
                  <Field label="Funcție"><input name="role" className={inputCls} /></Field>
                  <Field label="Email"><input name="email" type="email" className={inputCls} /></Field>
                  <Field label="Telefon"><input name="phone" className={inputCls} /></Field>
                  <Field label="Canal preferat">
                    <select name="preferred_channel" className={inputCls} defaultValue="whatsapp">
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                      <option value="apel">Apel</option>
                      <option value="altul">Altul</option>
                    </select>
                  </Field>
                  <div className="flex items-end"><button className={btnCls}>Adaugă</button></div>
                </form>
              </details>
            ) : null}
          </Card>

          <Card title="Note interne">
            {write ? (
              <form action={addNote} className="mb-3 flex gap-2">
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="client_id" value={id} />
                <input name="body" required placeholder="Scrie o notă…" className={inputCls} />
                <button className={btnCls}>Adaugă</button>
              </form>
            ) : null}
            {notes.length === 0 ? <Empty text="Nicio notă." /> : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className="whitespace-pre-wrap text-slate-800">{n.body}</p>
                    <p className="text-xs text-slate-500">{n.profiles?.full_name ?? "—"} · {fmtDateTime(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card title="Comenzi" className="mt-6">
        {orders.length === 0 ? <Empty text="Nicio comandă încă." /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead><tr><th className={th}>Nr.</th><th className={th}>Data</th><th className={th}>Status</th><th className={th}>Creative</th><th className={th}>Termen</th><th className={th}>Total</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className={td}><Link className="text-indigo-700 hover:underline" href={`/comenzi/${o.id}`}>#{o.number}</Link></td>
                    <td className={td}>{fmtDate(o.order_date)}</td>
                    <td className={td}><Badge value={o.status}>{ORDER_STATUS[o.status]}</Badge></td>
                    <td className={td}>{o.creatives_count}</td>
                    <td className={td}>{fmtDate(o.deadline)}</td>
                    <td className={td}>{fmtRON(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {write ? (
            <Card title="Notează o discuție">
              <form action={logInteraction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="client_id" value={id} />
                <Field label="Canal"><Select name="channel" options={CHANNELS} defaultValue="whatsapp" /></Field>
                <Field label="Tip"><input name="type" className={inputCls} placeholder="ex. feedback livrare" /></Field>
                <Field label="Rezumat *" className="sm:col-span-2"><textarea name="summary" required rows={3} className={inputCls} /></Field>
                <Field label="Starea clientului"><input name="client_state" className={inputCls} placeholder="mulțumit, grăbit…" /></Field>
                <Field label="Problemă"><input name="issue" className={inputCls} /></Field>
                <Field label="Feedback" className="sm:col-span-2"><input name="feedback" className={inputCls} /></Field>
                <Field label="Promisiune făcută"><input name="promise" className={inputCls} /></Field>
                <Field label="Termen promisiune"><input name="promise_due" type="date" className={inputCls} /></Field>
                <Field label="Rezultat" className="sm:col-span-2"><input name="outcome" className={inputCls} /></Field>
                <Field label="Următorul pas"><input name="next_step" className={inputCls} /></Field>
                <Field label="Data următorului pas"><input name="next_step_at" type="date" className={inputCls} /></Field>
                <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                  <input type="checkbox" name="make_task" /> Creează și un task pentru următorul pas
                </label>
                <div className="sm:col-span-2"><button className={btnCls}>Salvează discuția</button></div>
              </form>
            </Card>
          ) : null}

          <Card title="Taskuri deschise">
            {write ? (
              <form action={createTask} className="mb-3 grid gap-2 sm:grid-cols-[1fr_9rem_8rem_auto]">
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="client_id" value={id} />
                <input name="title" required placeholder="Task nou…" className={inputCls} />
                <input name="due_date" type="date" className={inputCls} />
                <Select name="priority" options={PRIORITY} defaultValue="normala" />
                <button className={btnCls}>Adaugă</button>
              </form>
            ) : null}
            {tasks.length === 0 ? <Empty text="Niciun task deschis." /> : (
              <ul className="divide-y divide-slate-100">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{t.title}</span>
                    <span className="text-xs text-slate-500">{fmtDate(t.due_date)} · {PRIORITY[t.priority]}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-500"><Link className="text-indigo-700 hover:underline" href="/taskuri">Gestionează taskurile</Link></p>
          </Card>
        </div>

        <Card title="Istoric discuții">
          {interactions.length === 0 ? <Empty text="Nicio discuție înregistrată." /> : (
            <ul className="space-y-4">
              {interactions.map((i) => (
                <li key={i.id} className={`text-sm ${i.cancelled ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{fmtDateTime(i.occurred_at)}</span>
                    <Badge tone="slate">{CHANNELS[i.channel]}</Badge>
                    <span>{i.profiles?.full_name ?? ""}</span>
                    {i.cancelled ? <Badge tone="red">Anulată</Badge> : null}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{i.summary}</p>
                  {i.issue ? <p className="text-xs text-red-700">Problemă: {i.issue}</p> : null}
                  {i.feedback ? <p className="text-xs text-slate-600">Feedback: {i.feedback}</p> : null}
                  {i.promise ? (
                    <p className={`text-xs ${i.promise_done ? "text-emerald-700" : "text-amber-700"}`}>
                      Promisiune: {i.promise} ({fmtDate(i.promise_due)}){i.promise_done ? " ✓" : ""}
                    </p>
                  ) : null}
                  {i.next_step ? <p className="text-xs text-slate-500">Pas: {i.next_step} ({fmtDate(i.next_step_at)})</p> : null}
                  {write && !i.cancelled ? (
                    <div className="mt-1 flex gap-2">
                      {i.promise ? (
                        <form action={togglePromise}>
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="done" value={i.promise_done ? "0" : "1"} />
                          <button className={btnSmall}>{i.promise_done ? "Redeschide promisiunea" : "Marchează îndeplinită"}</button>
                        </form>
                      ) : null}
                      <form action={cancelInteraction}>
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="id" value={i.id} />
                        <button className={btnSmall}>Anulează înregistrarea</button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
