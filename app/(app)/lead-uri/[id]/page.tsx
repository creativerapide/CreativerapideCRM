import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff, requireActive } from "@/lib/session";
import { Badge, Card, Empty, Field, Flash, PageHeader, Select, btnCls, btnGhost, btnSmall, inputCls } from "@/components/ui";
import { cancelInteraction, logInteraction, moveLead, updateLead } from "@/app/actions";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { CHANNELS, LEAD_STAGES, SOURCES } from "@/lib/constants";
import { WhatsAppCard } from "@/components/WhatsAppCard";
import { LEAD_TEMPLATES } from "@/lib/whatsapp";
import type { Row, SP } from "@/lib/types";

export default async function LeadDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const profile = await requireActive();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const write = isStaff(profile);

  const [leadR, interR, usersR] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase.from("interactions").select("*, profiles(full_name)").eq("lead_id", id).order("occurred_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").eq("active", true).neq("role", "viewer"),
  ]);
  const lead: Row | null = leadR.data;
  if (!lead) notFound();
  const interactions: Row[] = interR.data ?? [];
  const users: Row[] = usersR.data ?? [];
  const back = `/lead-uri/${id}`;

  return (
    <>
      <PageHeader
        title={lead.store_name}
        subtitle={`Lead creat la ${fmtDate(lead.created_at)}`}
        actions={
          <>
            <Badge value={lead.stage}>{LEAD_STAGES[lead.stage]}</Badge>
            <Link href="/lead-uri" className={btnGhost}>← Lead-uri</Link>
            {lead.client_id ? <Link href={`/clienti/${lead.client_id}`} className={btnGhost}>Vezi clientul</Link> : null}
          </>
        }
      />
      <Flash sp={sp} />

      {write && lead.stage !== "client" ? (
        <Card title="Etapă" className="mb-6">
          <form action={moveLead} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="id" value={id} />
            <Field label="Mută în etapa">
              <Select name="stage" options={LEAD_STAGES} defaultValue={lead.stage} />
            </Field>
            <Field label="Motiv (doar la „Pierdut”)" className="min-w-64 flex-1">
              <input name="lost_reason" defaultValue={lead.lost_reason ?? ""} className={inputCls} />
            </Field>
            <button className={btnCls}>Salvează etapa</button>
          </form>
          <p className="mt-2 text-xs text-slate-500">Alegerea etapei „Client” creează automat clientul, cu contactul și istoricul acestui lead.</p>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Detalii lead">
          <form action={updateLead} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="id" value={id} />
            <Field label="Magazin"><input name="store_name" defaultValue={lead.store_name} required disabled={!write} className={inputCls} /></Field>
            <Field label="Persoană de contact"><input name="contact_name" defaultValue={lead.contact_name ?? ""} disabled={!write} className={inputCls} /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={lead.email ?? ""} disabled={!write} className={inputCls} /></Field>
            <Field label="Telefon / WhatsApp"><input name="phone" defaultValue={lead.phone ?? ""} disabled={!write} className={inputCls} /></Field>
            <Field label="Website"><input name="website" defaultValue={lead.website ?? ""} disabled={!write} className={inputCls} /></Field>
            <Field label="Sursă"><Select name="source" options={SOURCES} defaultValue={lead.source ?? "email"} /></Field>
            <Field label="Reclame active"><input name="active_ads_count" type="number" min={0} defaultValue={lead.active_ads_count ?? ""} disabled={!write} className={inputCls} /></Field>
            <Field label="Varianta de email"><input name="email_variant" defaultValue={lead.email_variant ?? ""} disabled={!write} className={inputCls} /></Field>
            <Field label="Responsabil">
              <select name="owner_id" defaultValue={lead.owner_id ?? ""} disabled={!write} className={inputCls}>
                <option value="">—</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </Field>
            <Field label="Data următorului pas"><input name="next_step_at" type="date" defaultValue={lead.next_step_at ?? ""} disabled={!write} className={inputCls} /></Field>
            <Field label="Următorul pas" className="sm:col-span-2"><input name="next_step" defaultValue={lead.next_step ?? ""} disabled={!write} className={inputCls} /></Field>
            <Field label="Note" className="sm:col-span-2"><textarea name="notes" rows={3} defaultValue={lead.notes ?? ""} disabled={!write} className={inputCls} /></Field>
            {write ? <div className="sm:col-span-2"><button className={btnCls}>Salvează</button></div> : null}
          </form>
        </Card>

        <div className="space-y-6">
          <WhatsAppCard phone={lead.phone} nume={lead.contact_name} magazin={lead.store_name} templates={LEAD_TEMPLATES} back={back} leadId={id} write={write} />
          {write ? (
            <Card title="Notează o discuție">
              <form action={logInteraction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="lead_id" value={id} />
                <Field label="Canal"><Select name="channel" options={CHANNELS} defaultValue="whatsapp" /></Field>
                <Field label="Tip"><input name="type" className={inputCls} placeholder="ex. primul contact" /></Field>
                <Field label="Rezumat *" className="sm:col-span-2"><textarea name="summary" required rows={3} className={inputCls} /></Field>
                <Field label="Promisiune făcută"><input name="promise" className={inputCls} /></Field>
                <Field label="Termen promisiune"><input name="promise_due" type="date" className={inputCls} /></Field>
                <Field label="Următorul pas"><input name="next_step" className={inputCls} /></Field>
                <Field label="Data următorului pas"><input name="next_step_at" type="date" className={inputCls} /></Field>
                <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                  <input type="checkbox" name="make_task" /> Creează și un task pentru următorul pas
                </label>
                <div className="sm:col-span-2"><button className={btnCls}>Salvează discuția</button></div>
              </form>
            </Card>
          ) : null}

          <Card title="Istoric discuții">
            {interactions.length === 0 ? (
              <Empty text="Nicio discuție înregistrată." />
            ) : (
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
                    {i.promise ? <p className="text-xs text-amber-700">Promisiune: {i.promise} ({fmtDate(i.promise_due)})</p> : null}
                    {i.next_step ? <p className="text-xs text-slate-500">Pas: {i.next_step} ({fmtDate(i.next_step_at)})</p> : null}
                    {write && !i.cancelled ? (
                      <form action={cancelInteraction} className="mt-1">
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="id" value={i.id} />
                        <button className={btnSmall}>Anulează înregistrarea</button>
                      </form>
                    ) : null}
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
