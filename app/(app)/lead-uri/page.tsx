import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isStaff, requireActive } from "@/lib/session";
import { Badge, Card, Empty, Field, Flash, PageHeader, Select, btnCls, btnSmall, inputCls } from "@/components/ui";
import { createLead, moveLead } from "@/app/actions";
import { fmtDate, todayISO } from "@/lib/format";
import { LEAD_STAGES, SOURCES } from "@/lib/constants";
import { waNumber } from "@/lib/whatsapp";
import type { Row, SP } from "@/lib/types";

const COLUMNS = ["raspuns_email", "contactat_whatsapp", "test_trimis", "client", "pierdut"];

export default async function LeadsPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  const sp = await searchParams;
  const supabase = await createClient();
  const write = isStaff(profile);
  const today = todayISO();

  const [leadsR, usersR] = await Promise.all([
    supabase.from("leads").select("id, store_name, contact_name, phone, stage, active_ads_count, next_step, next_step_at, owner_id, created_at, lost_reason").eq("archived", false).order("created_at", { ascending: false }).limit(500),
    supabase.from("profiles").select("id, full_name").eq("active", true).neq("role", "viewer"),
  ]);
  const leads: Row[] = leadsR.data ?? [];
  const users: Row[] = usersR.data ?? [];
  const owner = (id: string | null) => users.find((u) => u.id === id)?.full_name ?? "—";
  const back = "/lead-uri";

  return (
    <>
      <PageHeader
        title="Lead-uri"
        subtitle="Persoanele care au răspuns la outreach, de la primul răspuns până la client."
      />
      <Flash sp={sp} />

      {write ? (
        <details open={sp.nou === "1"} className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">+ Adaugă lead</summary>
          <form action={createLead} className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="back" value={back} />
            <Field label="Magazin *"><input name="store_name" required className={inputCls} /></Field>
            <Field label="Persoană de contact"><input name="contact_name" className={inputCls} /></Field>
            <Field label="Email"><input name="email" type="email" className={inputCls} /></Field>
            <Field label="Telefon / WhatsApp"><input name="phone" className={inputCls} placeholder="07xx xxx xxx" /></Field>
            <Field label="Website"><input name="website" className={inputCls} placeholder="magazin.ro" /></Field>
            <Field label="Sursă"><Select name="source" options={SOURCES} defaultValue="email" /></Field>
            <Field label="Reclame active (Ad Library)"><input name="active_ads_count" type="number" min={0} className={inputCls} /></Field>
            <Field label="Varianta de email"><input name="email_variant" className={inputCls} placeholder="ex. V2 sau MIX-9" /></Field>
            <Field label="Responsabil">
              <select name="owner_id" className={inputCls} defaultValue="">
                <option value="">Eu</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </Field>
            <Field label="Următorul pas"><input name="next_step" className={inputCls} placeholder="ex. Trimite test gratuit" /></Field>
            <Field label="Data următorului pas"><input name="next_step_at" type="date" className={inputCls} /></Field>
            <Field label="Note" className="sm:col-span-2 lg:col-span-3"><textarea name="notes" rows={2} className={inputCls} /></Field>
            <div className="sm:col-span-2 lg:col-span-3"><button className={btnCls}>Salvează lead</button></div>
          </form>
        </details>
      ) : null}

      {leads.length === 0 ? (
        <Empty text="Încă nu există lead-uri. Adaugă primul lead sau mută aici răspunsurile din outreach." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((stage) => {
            const items = leads.filter((l) => l.stage === stage);
            const shown = stage === "client" || stage === "pierdut" ? items.slice(0, 15) : items;
            return (
              <div key={stage} className="w-72 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-slate-800">{LEAD_STAGES[stage]}</h2>
                  <Badge tone="slate">{items.length}</Badge>
                </div>
                <div className="space-y-3">
                  {shown.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">Gol</div>
                  ) : null}
                  {shown.map((l) => (
                    <Card key={l.id} className="!shadow-none">
                      <Link href={`/lead-uri/${l.id}`} className="block font-medium text-indigo-700 hover:underline">{l.store_name}</Link>
                      <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                        {l.contact_name ? <div>{l.contact_name}{l.phone ? ` · ${l.phone}` : ""}</div> : l.phone ? <div>{l.phone}</div> : null}
                        {waNumber(l.phone) ? <div><a href={`https://wa.me/${waNumber(l.phone)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline">WhatsApp</a></div> : null}
                        {l.active_ads_count != null ? <div>{l.active_ads_count} reclame active</div> : null}
                        <div>Responsabil: {owner(l.owner_id)}</div>
                        {l.next_step ? (
                          <div className={l.next_step_at && l.next_step_at < today ? "text-red-600" : ""}>
                            Pas: {l.next_step}{l.next_step_at ? ` (${fmtDate(l.next_step_at)})` : ""}
                          </div>
                        ) : null}
                        {stage === "pierdut" && l.lost_reason ? <div>Motiv: {l.lost_reason}</div> : null}
                      </div>
                      {write && stage !== "client" ? (
                        <form action={moveLead} className="mt-3 space-y-2">
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="id" value={l.id} />
                          <select name="stage" defaultValue={stage} className={`${inputCls} !py-1.5 !text-xs`}>
                            {COLUMNS.map((s) => <option key={s} value={s}>{LEAD_STAGES[s]}</option>)}
                          </select>
                          <input name="lost_reason" placeholder="Motiv (obligatoriu la „Pierdut”)" className={`${inputCls} !py-1.5 !text-xs`} />
                          <button className={btnSmall}>Mută</button>
                        </form>
                      ) : null}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
