import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canRead, hasFinance, isAdmin, isStaff, requireActive } from "@/lib/session";
import { Badge, Card, Empty, Field, Flash, PageHeader, Select, btnCls, btnGhost, btnSmall, inputCls, td, th } from "@/components/ui";
import { deleteOrder } from "@/app/delete-order";
import { markOrderSent } from "@/app/order-quick";
import { markOrderPaid } from "@/app/stage2-actions";
import { addEditorWork, deleteEditorWork } from "@/app/editors-actions";
import EditWork from "@/components/EditWork";
import { addCreatives, bulkCreativeStatus, updateCreative, updateOrder, updateOrderEditor } from "@/app/actions";
import { fmtDate, fmtDateTime, fmtRON, todayISO } from "@/lib/format";
import { CREATIVE_STATUS, FINANCIAL, ORDER_STATUS, PACKAGES } from "@/lib/constants";
import type { Row, SP } from "@/lib/types";

const QC_ITEMS: Record<string, string> = {
  audio: "Sunet ok",
  text: "Text / subtitrări ok",
  format: "Format corect",
  greseli: "Fără greșeli",
};

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const profile = await requireActive();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const write = isStaff(profile);
  const isEditor = profile.role === "editor";
  const money = canRead(profile);
  const canPay = hasFinance(profile);
  const today = todayISO();

  const [orderR, creativesR, usersR, edsR, workR] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("creatives").select("*").eq("order_id", id).order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name").eq("active", true).neq("role", "viewer"),
    canPay ? supabase.from("editors").select("id, name, rate, active").order("name") : Promise.resolve({ data: [] as Row[] }),
    canPay ? supabase.from("editor_work").select("id, editor_id, creatives, rate, amount, work_date, notes, editors(name)").eq("order_id", id).order("created_at", { ascending: true }) : Promise.resolve({ data: [] as Row[] }),
  ]);
  const o: Row | null = orderR.data;
  if (!o) notFound();
  const creatives: Row[] = creativesR.data ?? [];
  const users: Row[] = usersR.data ?? [];
  const allEditors: Row[] = edsR.data ?? [];
  const work: Row[] = workR.data ?? [];
  const workDone = work.reduce((a, w) => a + Number(w.creatives), 0);
  const workTotal = work.reduce((a, w) => a + Number(w.amount), 0);
  const workLeft = Math.max(0, Number(o?.creatives_count ?? 0) - workDone);
  const back = `/comenzi/${id}`;
  const editorName = (uid: string | null) => users.find((u) => u.id === uid)?.full_name ?? "—";
  const late = o.deadline && o.deadline < today && !["livrata", "anulata"].includes(o.status);
  const pending = creatives.filter((c) => !["livrata", "anulata"].includes(c.status)).length;

  return (
    <>
      <PageHeader
        title={`Comanda #${o.number}`}
        subtitle={`${o.client_name} · ${fmtDate(o.order_date)}`}
        actions={
          <>
            <Badge value={o.status}>{ORDER_STATUS[o.status]}</Badge>
            {late ? <Badge tone="red">Întârziată</Badge> : null}
            {write && o.status !== "anulata" ? (
              <form action={markOrderSent}>
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="order_id" value={id} />
                {o.status === "livrata" ? <input type="hidden" name="undo" value="1" /> : null}
                <button className={o.status === "livrata" ? "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" : "rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"}>
                  {o.status === "livrata" ? "✓ Trimisă (readu în lucru)" : "Comandă trimisă"}
                </button>
              </form>
            ) : null}
            {canPay && o.status !== "anulata" && o.financial_status !== "incasata" ? (
              <form action={markOrderPaid} className="flex items-center gap-1">
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="order_id" value={id} />
                <input type="hidden" name="method" value="ramburs" />
                <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Încasat</button>
              </form>
            ) : null}
            {o.financial_status === "incasata" ? <Badge tone="green">Încasată</Badge> : null}
            <Link href="/comenzi" className={btnGhost}>← Comenzi</Link>
            {!isEditor ? <Link href={`/clienti/${o.client_id}`} className={btnGhost}>Vezi clientul</Link> : null}
          </>
        }
      />
      <Flash sp={sp} />
      {isAdmin(profile) ? (
        <details className="mb-6 rounded-xl border border-red-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-red-700">Șterge comanda</summary>
          <form action={deleteOrder} className="space-y-3 border-t border-red-100 p-4">
            <input type="hidden" name="id" value={id} />
            <p className="text-sm text-slate-600">Comanda #{o.number}, creativele ei și facturile/încasările legate de ea se șterg definitiv. Dacă doar nu se mai face, e mai sigur să pui statusul „Anulată”.</p>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="confirm" /> Confirm că vreau să șterg definitiv această comandă</label>
            <button className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">Șterge definitiv</button>
          </form>
        </details>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Detalii comandă">
          {write ? (
            <form action={updateOrder} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="client_id" value={o.client_id} />
              <Field label="Status"><Select name="status" options={ORDER_STATUS} defaultValue={o.status} /></Field>
              <Field label="Status financiar"><Select name="financial_status" options={FINANCIAL} defaultValue={o.financial_status} /></Field>
              <Field label="Data comenzii"><input name="order_date" type="date" defaultValue={o.order_date} className={inputCls} /></Field>
              <Field label="Pachet"><Select name="package" options={PACKAGES} defaultValue={o.package ?? "standard"} /></Field>
              <Field label="Număr de creative"><input name="creatives_count" type="number" min={0} defaultValue={o.creatives_count} className={inputCls} /></Field>
              <Field label="Termen de livrare"><input name="deadline" type="date" defaultValue={o.deadline ?? ""} className={inputCls} /></Field>
              <Field label="Preț convenit (RON)"><input name="price_agreed" inputMode="decimal" defaultValue={o.price_agreed} className={inputCls} /></Field>
              <Field label="Discount (RON)"><input name="discount" inputMode="decimal" defaultValue={o.discount} className={inputCls} /></Field>
              <Field label="Editor" className="sm:col-span-2">
                <select name="editor_id" defaultValue={o.editor_id ?? ""} className={inputCls}>
                  <option value="">Nealocat</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </Field>
              <Field label="Link brief"><input name="brief_url" defaultValue={o.brief_url ?? ""} className={inputCls} /></Field>
              <Field label="Link asseturi"><input name="assets_url" defaultValue={o.assets_url ?? ""} className={inputCls} /></Field>
              <Field label="Link livrare" className="sm:col-span-2"><input name="delivery_url" defaultValue={o.delivery_url ?? ""} className={inputCls} /></Field>
              <Field label="Observații" className="sm:col-span-2"><textarea name="notes" rows={3} defaultValue={o.notes ?? ""} className={inputCls} /></Field>
              <div className="flex items-center justify-between sm:col-span-2">
                <button className={btnCls}>Salvează</button>
                <span className="text-sm text-slate-500">Total: <strong className="text-slate-900">{fmtRON(o.total)}</strong></span>
              </div>
            </form>
          ) : isEditor ? (
            <>
              <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-slate-500">Termen</dt><dd>{fmtDate(o.deadline)}</dd></div>
                <div><dt className="text-xs text-slate-500">Creative</dt><dd>{o.creatives_count}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-slate-500">Brief</dt><dd>{o.brief_url ? <a className="text-indigo-700 underline" href={o.brief_url} target="_blank" rel="noreferrer">Deschide brief</a> : "—"}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-slate-500">Asseturi</dt><dd>{o.assets_url ? <a className="text-indigo-700 underline" href={o.assets_url} target="_blank" rel="noreferrer">Deschide asseturi</a> : "—"}</dd></div>
              </dl>
              <form action={updateOrderEditor} className="grid gap-4">
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="id" value={id} />
                <Field label="Status"><Select name="status" options={ORDER_STATUS} defaultValue={o.status} /></Field>
                <Field label="Link livrare"><input name="delivery_url" defaultValue={o.delivery_url ?? ""} className={inputCls} /></Field>
                <Field label="Observații"><textarea name="notes" rows={3} defaultValue={o.notes ?? ""} className={inputCls} /></Field>
                <div><button className={btnCls}>Salvează</button></div>
              </form>
            </>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-slate-500">Editor</dt><dd>{editorName(o.editor_id)}</dd></div>
              <div><dt className="text-xs text-slate-500">Termen</dt><dd>{fmtDate(o.deadline)}</dd></div>
              <div><dt className="text-xs text-slate-500">Creative</dt><dd>{o.creatives_count}</dd></div>
              {money ? <div><dt className="text-xs text-slate-500">Total</dt><dd>{fmtRON(o.total)}</dd></div> : null}
            </dl>
          )}
          {o.delivered_at ? <p className="mt-3 text-xs text-emerald-700">Livrată efectiv la {fmtDateTime(o.delivered_at)}</p> : null}
        </Card>

        <Card title="Creative">
          <p className="mb-3 text-sm text-slate-600">
            {creatives.length} creative, {pending} nelivrate. Comanda poate fi marcată „Livrată” doar după ce toate creativele sunt livrate sau anulate.
          </p>
          {write ? (
            <form action={addCreatives} className="mb-4 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="order_id" value={id} />
              <Field label="Câte creative"><input name="count" type="number" min={1} max={100} defaultValue={1} className={inputCls} /></Field>
              <Field label="Produs"><input name="product" className={inputCls} /></Field>
              <Field label="Unghi publicitar"><input name="angle" className={inputCls} /></Field>
              <Field label="Termen"><input name="deadline" type="date" defaultValue={o.deadline ?? ""} className={inputCls} /></Field>
              <Field label="Editor" className="sm:col-span-2">
                <select name="editor_id" defaultValue={o.editor_id ?? ""} className={inputCls}>
                  <option value="">Nealocat</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2"><button className={btnCls}>Adaugă creative</button></div>
            </form>
          ) : null}

          {creatives.length === 0 ? (
            <Empty text="Nicio creativă adăugată încă." />
          ) : (
            <>
              <form id="bulk" action={bulkCreativeStatus} className="mb-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="back" value={back} />
                <Field label="Schimbă statusul celor bifate" className="w-56"><Select name="status" options={CREATIVE_STATUS} defaultValue="in_lucru" /></Field>
                <button className={btnSmall}>Aplică</button>
              </form>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr>
                      <th className={th}></th>
                      <th className={th}>Produs / unghi</th>
                      <th className={th}>Status</th>
                      <th className={th}>Termen</th>
                      <th className={th}>Rev.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {creatives.map((c) => (
                      <tr key={c.id}>
                        <td className={td}><input type="checkbox" name="ids" value={c.id} form="bulk" aria-label="Selectează" /></td>
                        <td className={td}>{c.product ?? "—"}{c.angle ? <div className="text-xs text-slate-500">{c.angle}</div> : null}</td>
                        <td className={td}><Badge value={c.status}>{CREATIVE_STATUS[c.status]}</Badge></td>
                        <td className={`${td} ${c.deadline && c.deadline < today && !["livrata", "anulata"].includes(c.status) ? "text-red-600" : ""}`}>{fmtDate(c.deadline)}</td>
                        <td className={td}>{c.revisions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      {canPay ? (
        <Card title="Editori pe această comandă (cât are de primit fiecare)" className="mt-6">
          <p className="mb-3 text-sm text-slate-600">
            {workDone} din {o.creatives_count} creative atribuite editorilor
            {workLeft > 0 ? <> · <strong className="text-amber-700">{workLeft} neatribuite</strong></> : null}
            {work.length ? <> · de plătit editorilor: <strong className="text-slate-900">{fmtRON(workTotal)}</strong></> : null}
          </p>
          {work.length > 0 ? (
            <div className="mb-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr>
                    <th className={th}>Editor</th>
                    <th className={th}>Creative</th>
                    <th className={th}>Tarif</th>
                    <th className={th}>Total</th>
                    <th className={th}>Data</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {work.map((w) => (
                    <tr key={w.id}>
                      <td className={td}><Link className="text-indigo-700 hover:underline" href={`/editori/${w.editor_id}`}>{(Array.isArray(w.editors) ? w.editors[0] : w.editors)?.name ?? "—"}</Link>{w.notes ? <div className="text-xs text-slate-500">{w.notes}</div> : null}</td>
                      <td className={td}>{w.creatives}</td>
                      <td className={td}>{fmtRON(w.rate)}</td>
                      <td className={`${td} font-medium text-slate-900`}>{fmtRON(w.amount)}</td>
                      <td className={td}>{fmtDate(w.work_date)}</td>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <EditWork w={w} back={back} />
                          <form action={deleteEditorWork}>
                            <input type="hidden" name="back" value={back} />
                            <input type="hidden" name="id" value={w.id} />
                            <button className={btnSmall}>Șterge</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {allEditors.filter((e) => e.active).length === 0 ? (
            <p className="text-sm text-slate-500">Nu ai niciun editor activ. <Link className="text-indigo-700 underline" href="/editori">Adaugă editori aici</Link>.</p>
          ) : (
            <form action={addEditorWork} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="order_id" value={id} />
              <Field label="Editor">
                <select name="editor_id" required defaultValue="" className={inputCls}>
                  <option value="" disabled>Alege editorul</option>
                  {allEditors.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name} · {fmtRON(e.rate)}</option>)}
                </select>
              </Field>
              <Field label="Câte creative"><input name="creatives" type="number" min={1} max={1000} defaultValue={workLeft || 1} required className={inputCls} /></Field>
              <Field label="Tarif (RON)" hint="Gol = tariful editorului"><input name="rate" inputMode="decimal" className={inputCls} placeholder="implicit" /></Field>
              <Field label="SAU suma totală (RON)" hint="Cât primește pe comandă"><input name="total" inputMode="decimal" className={inputCls} placeholder="ex. 60" /></Field>
              <Field label="Data"><input name="work_date" type="date" defaultValue={today} className={inputCls} /></Field>
              <Field label="Note" className="sm:col-span-2"><input name="notes" className={inputCls} placeholder="opțional" /></Field>
              <div className="flex items-end"><button className={btnCls}>Adaugă</button></div>
            </form>
          )}
        </Card>
      ) : null}

      {creatives.length > 0 ? (
        <Card title="Editare creative (livrare, QC, feedback)" className="mt-6">
          <div className="space-y-2">
            {creatives.map((c, idx) => (
              <details key={c.id} className="rounded-lg border border-slate-200">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">Creativ {idx + 1}{c.product ? ` · ${c.product}` : ""}</span>
                  <Badge value={c.status}>{CREATIVE_STATUS[c.status]}</Badge>
                </summary>
                <form action={updateCreative} className="grid gap-3 border-t border-slate-100 p-3 sm:grid-cols-2">
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="qc" value="1" />
                  <Field label="Status"><Select name="status" options={CREATIVE_STATUS} defaultValue={c.status} /></Field>
                  <Field label="Revizii"><input name="revisions" type="number" min={0} defaultValue={c.revisions} className={inputCls} /></Field>
                  {write ? <Field label="Produs"><input name="product" defaultValue={c.product ?? ""} className={inputCls} /></Field> : null}
                  {write ? <Field label="Unghi publicitar"><input name="angle" defaultValue={c.angle ?? ""} className={inputCls} /></Field> : null}
                  <Field label="Link material sursă"><input name="source_url" defaultValue={c.source_url ?? ""} className={inputCls} /></Field>
                  <Field label="Link livrare"><input name="delivery_url" defaultValue={c.delivery_url ?? ""} className={inputCls} /></Field>
                  <fieldset className="sm:col-span-2">
                    <legend className="mb-1 text-sm font-medium text-slate-700">Checklist QC</legend>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(QC_ITEMS).map(([k, label]) => (
                        <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" name={`qc_${k}`} defaultChecked={Boolean(c.qc_checklist?.[k])} /> {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Field label="Feedback" className="sm:col-span-2"><textarea name="feedback" rows={2} defaultValue={c.feedback ?? ""} className={inputCls} /></Field>
                  <div className="sm:col-span-2"><button className={btnCls}>Salvează creativul</button></div>
                </form>
              </details>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
