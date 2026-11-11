import { Field, btnCls, btnSmall, inputCls } from "@/components/ui";
import { updateEditorWork } from "@/app/editors-actions";
import type { Row } from "@/lib/types";

/** Formular de modificare pentru o lucrare de editor (se deschide din rând). */
export default function EditWork({ w, back }: { w: Row; back: string }) {
  return (
    <details className="relative">
      <summary className={`${btnSmall} cursor-pointer list-none`}>Modifică</summary>
      <form action={updateEditorWork} className="absolute right-0 z-10 mt-1 grid w-72 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <input type="hidden" name="back" value={back} />
        <input type="hidden" name="id" value={w.id} />
        <Field label="Câte creative"><input name="creatives" type="number" min={1} required defaultValue={w.creatives} className={inputCls} /></Field>
        <Field label="Tarif / creativă (RON)"><input name="rate" inputMode="decimal" defaultValue={w.rate} className={inputCls} /></Field>
        <Field label="SAU suma totală (RON)" hint="Dacă o completezi, tariful se calculează din ea."><input name="total" inputMode="decimal" className={inputCls} placeholder={String(w.amount)} /></Field>
        <Field label="Data"><input name="work_date" type="date" defaultValue={w.work_date} className={inputCls} /></Field>
        <Field label="Note"><input name="notes" defaultValue={w.notes ?? ""} className={inputCls} /></Field>
        <button className={btnCls}>Salvează</button>
      </form>
    </details>
  );
}
