import { logInteraction } from "@/app/actions";
import { ConversationCard } from "@/components/ConversationCard";
import { createClient } from "@/lib/supabase/server";
import { Card, btnSmall } from "@/components/ui";
import { fill, waLink, waNumber, type WaTemplate } from "@/lib/whatsapp";

const waBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function WhatsAppCard({
  phone,
  nume,
  magazin,
  templates,
  back,
  leadId,
  clientId,
  write,
}: {
  phone?: string | null;
  nume?: string | null;
  magazin?: string | null;
  templates: WaTemplate[];
  back: string;
  leadId?: string;
  clientId?: string;
  write: boolean;
}) {
  const ok = !!waNumber(phone);
  let messages: Record<string, any>[] = [];
  if (write && (leadId || clientId)) {
    const supabase = await createClient();
    const q = supabase
      .from("whatsapp_messages")
      .select("id, direction, body, msg_type, wa_name, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(60);
    const { data } = await (leadId ? q.eq("lead_id", leadId) : q.eq("client_id", clientId!));
    messages = data ?? [];
  }
  return (
    <>
    {write ? <ConversationCard messages={messages} /> : null}
    <Card title="WhatsApp">
      {!ok ? (
        <p className="text-sm text-slate-500">Adaugă un număr de telefon valid (ex. 07xx xxx xxx) ca să poți scrie direct din CRM.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <a href={waLink(phone, "")!} target="_blank" rel="noopener noreferrer" className={waBtn}>
              Deschide chat gol
            </a>
            <span className="text-xs text-slate-500">+{waNumber(phone)}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {templates.map((t) => {
              const text = fill(t.text, { nume, magazin });
              return (
                <li key={t.id} className="py-3">
                  <div className="text-sm font-medium text-slate-900">{t.label}</div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a href={waLink(phone, text)!} target="_blank" rel="noopener noreferrer" className={waBtn}>
                      Trimite pe WhatsApp
                    </a>
                    {write ? (
                      <form action={logInteraction}>
                        <input type="hidden" name="back" value={back} />
                        {leadId ? <input type="hidden" name="lead_id" value={leadId} /> : null}
                        {clientId ? <input type="hidden" name="client_id" value={clientId} /> : null}
                        <input type="hidden" name="channel" value="whatsapp" />
                        <input type="hidden" name="type" value={t.label} />
                        <input type="hidden" name="summary" value={`Mesaj WhatsApp trimis: ${t.label}.`} />
                        <button className={btnSmall}>Notează ca trimis</button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Butonul verde deschide WhatsApp cu mesajul gata scris; îl poți edita înainte de trimitere. După ce l-ai trimis, apasă „Notează ca trimis” ca să rămână în istoric.
          </p>
        </>
      )}
    </Card>
    </>
  );
}
