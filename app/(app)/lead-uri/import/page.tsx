import Link from "next/link";
import { redirect } from "next/navigation";
import { isStaff, requireActive } from "@/lib/session";
import { Card, Flash, PageHeader, btnCls, btnGhost, inputCls } from "@/components/ui";
import { importLeads } from "@/app/stage2-actions";
import type { SP } from "@/lib/types";

export default async function ImportLeadsPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  if (!isStaff(profile)) redirect("/lead-uri");
  const sp = await searchParams;

  return (
    <>
      <PageHeader
        title="Import lead-uri"
        subtitle="Lipește răspunsurile din foaia de outreach. Duplicatele (același email) sunt ignorate automat."
        actions={<Link href="/lead-uri" className={btnGhost}>← Lead-uri</Link>}
      />
      <Flash sp={sp} />
      <Card>
        <form action={importLeads} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="date">Rânduri (unul pe linie)</label>
            <textarea
              id="date"
              name="date"
              rows={12}
              required
              className={`${inputCls} font-mono`}
              placeholder={"magazin;email;telefon;varianta;reclame\nSprise;comenzi@sprise.ro;0768000000;2;12\nFamify;contact@famify.ro;;4;"}
            />
          </div>
          <div className="text-xs text-slate-500">
            <p>Coloane, separate prin punct și virgulă sau tab: <strong>magazin</strong> (obligatoriu), <strong>email</strong>, <strong>telefon</strong>, <strong>varianta</strong> de email, numărul de <strong>reclame</strong> active.</p>
            <p className="mt-1">Fiecare rând trebuie să aibă măcar email sau telefon. Poți copia direct coloanele din Google Sheets. Maximum 500 de rânduri odată. Lead-urile intră în etapa „Au răspuns pe email”, cu tine ca responsabil.</p>
          </div>
          <button className={btnCls}>Importă</button>
        </form>
      </Card>
    </>
  );
}
