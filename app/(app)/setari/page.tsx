import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, requireActive } from "@/lib/session";
import { Badge, Card, Flash, PageHeader, btnSmall, inputCls, td, th } from "@/components/ui";
import Link from "next/link";
import { updateUserFull } from "@/app/stage2-actions";
import { fmtDate } from "@/lib/format";
import { ROLES, TARGET_LUNAR_RON } from "@/lib/constants";
import { fmtRON } from "@/lib/format";
import type { Row, SP } from "@/lib/types";

export default async function SettingsPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  if (!isAdmin(profile)) redirect("/");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email, role, active, finance_access, created_at").order("created_at", { ascending: true });
  const users: Row[] = data ?? [];
  const pending = users.filter((u) => !u.active);

  return (
    <>
      <PageHeader title="Setări" subtitle="Utilizatori, roluri și reguli generale." actions={<Link href="/setari/audit" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Jurnal de modificări</Link>} />
      <Flash sp={sp} />

      <Card title="Utilizatori și roluri" className="mb-6">
        {pending.length ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {pending.length} cont(uri) așteaptă aprobarea. Alege rolul, bifează „Activ” și salvează.
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr><th className={th}>Utilizator</th><th className={th}>Rol</th><th className={th}>Activ</th><th className={th}>Acces financiar</th><th className={th}>Creat</th><th className={th}></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className={td}>
                    <form id={`u-${u.id}`} action={updateUserFull}>
                      <input type="hidden" name="id" value={u.id} />
                    </form>
                    <input form={`u-${u.id}`} name="full_name" defaultValue={u.full_name ?? ""} className={`${inputCls} !py-1.5`} />
                    <div className="mt-1 text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className={td}>
                    <select form={`u-${u.id}`} name="role" defaultValue={u.role} className={`${inputCls} !py-1.5`}>
                      {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className={td}>
                    <label className="flex items-center gap-2">
                      <input form={`u-${u.id}`} type="checkbox" name="active" defaultChecked={u.active} />
                      {u.active ? <Badge tone="green">Activ</Badge> : <Badge tone="amber">În așteptare</Badge>}
                    </label>
                  </td>
                  <td className={td}>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input form={`u-${u.id}`} type="checkbox" name="finance_access" defaultChecked={u.finance_access} disabled={u.role === "admin"} />
                      {u.role === "admin" ? "mereu" : "facturi și costuri"}
                    </label>
                  </td>
                  <td className={td}>{fmtDate(u.created_at)}</td>
                  <td className={td}><button form={`u-${u.id}`} className={btnSmall}>Salvează</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Ce poate face fiecare rol">
          <dl className="space-y-2 text-sm">
            <div><dt className="font-medium text-slate-900">Admin</dt><dd className="text-slate-600">Acces complet, inclusiv utilizatori, ștergeri și jurnalul de modificări.</dd></div>
            <div><dt className="font-medium text-slate-900">Account manager</dt><dd className="text-slate-600">Lead-uri, clienți, comenzi, interacțiuni și taskuri. Nu poate șterge date și nu gestionează utilizatori.</dd></div>
            <div><dt className="font-medium text-slate-900">Editor</dt><dd className="text-slate-600">Vede doar comenzile și creativele alocate lui; poate schimba statusul, linkul de livrare, QC și feedbackul.</dd></div>
            <div><dt className="font-medium text-slate-900">Vizualizare</dt><dd className="text-slate-600">Doar citire.</dd></div>
          </dl>
        </Card>
        <Card title="Reguli generale">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Țintă lunară: {fmtRON(TARGET_LUNAR_RON)} (în cod, în <code>lib/constants.ts</code>).</li>
            <li>Tarife: Standard 20 RON / reclamă (19 RON la 50+), Plus 30 RON, Performanță 35 RON; pachetele personalizate se negociază.</li>
            <li>Ofertă de start (până pe 30 noiembrie): la prima comandă a unui client, minim 6 reclame, 2 reclame costă 10 RON, restul 20 RON. Se alege pachetul „Ofertă de start” la comandă.</li>
            <li>Un client este „la risc” dacă are risc ridicat sau nu a comandat de 21 de zile.</li>
            <li>Fus orar: Europa/București. Format dată: zz.ll.aaaa. Monedă: RON.</li>
            <li>Primul cont creat devine administrator; restul așteaptă aprobarea.</li>
            <li>Automatizări zilnice la 07:00 (ora României): follow-up după livrare, reactivare după 21 de zile fără comandă, lead-uri fără contact, promisiuni depășite, raport lunar (în prima zi a lunii), facturi restante.</li>
            <li>Accesul la facturi, încasări și costuri îl au adminul și account managerii cu „Acces financiar” bifat.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
