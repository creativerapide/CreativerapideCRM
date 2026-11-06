import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff, requireActive } from "@/lib/session";
import { Badge, Card, Empty, Field, Flash, PageHeader, Select, btnCls, btnGhost, btnSmall, inputCls } from "@/components/ui";
import { createTask, setTaskStatus } from "@/app/actions";
import { fmtDate, todayISO } from "@/lib/format";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { one, type Row, type SP } from "@/lib/types";

const VIEWS: Record<string, string> = { deschise: "Deschise", azi: "Azi", restante: "Restante", mele: "Ale mele", facute: "Făcute" };

export default async function TasksPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  if (profile.role === "editor") redirect("/comenzi");
  const sp = await searchParams;
  const supabase = await createClient();
  const write = isStaff(profile);
  const today = todayISO();
  const view = sp.vedere && VIEWS[sp.vedere] ? sp.vedere : "deschise";

  let query = supabase
    .from("tasks")
    .select("id, title, description, due_date, priority, status, assignee_id, auto_generated, client_id, lead_id, clients(id, name), leads(id, store_name), profiles:assignee_id(full_name)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(300);
  if (view === "facute") query = query.eq("status", "facut").order("completed_at", { ascending: false });
  else query = query.in("status", ["de_facut", "in_lucru"]);
  if (view === "azi") query = query.eq("due_date", today);
  if (view === "restante") query = query.lt("due_date", today);
  if (view === "mele") query = query.eq("assignee_id", profile.id);

  const [listR, usersR, clientsR] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name").eq("active", true).neq("role", "viewer"),
    supabase.from("clients").select("id, name").eq("archived", false).order("name").limit(1000),
  ]);
  const tasks: Row[] = listR.data ?? [];
  const users: Row[] = usersR.data ?? [];
  const clients: Row[] = clientsR.data ?? [];
  const back = view === "deschise" ? "/taskuri" : `/taskuri?vedere=${view}`;

  return (
    <>
      <PageHeader title="Taskuri" subtitle="Follow-up-uri și lucruri de făcut." />
      <Flash sp={sp} />

      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(VIEWS).map(([k, label]) => (
          <Link key={k} href={k === "deschise" ? "/taskuri" : `/taskuri?vedere=${k}`} className={k === view ? `${btnCls}` : btnGhost}>
            {label}
          </Link>
        ))}
      </div>

      {write ? (
        <Card title="Task nou" className="mb-6">
          <form action={createTask} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="back" value={back} />
            <Field label="Titlu *" className="lg:col-span-2"><input name="title" required className={inputCls} /></Field>
            <Field label="Termen"><input name="due_date" type="date" className={inputCls} /></Field>
            <Field label="Prioritate"><Select name="priority" options={PRIORITY} defaultValue="normala" /></Field>
            <Field label="Responsabil">
              <select name="assignee_id" defaultValue="" className={inputCls}>
                <option value="">Eu</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </Field>
            <Field label="Client (opțional)">
              <select name="client_id" defaultValue="" className={inputCls}>
                <option value="">—</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Detalii" className="lg:col-span-2"><input name="description" className={inputCls} /></Field>
            <div className="sm:col-span-2 lg:col-span-4"><button className={btnCls}>Creează task</button></div>
          </form>
        </Card>
      ) : null}

      {tasks.length === 0 ? (
        <Empty text="Niciun task în această vedere." />
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const c = one(t.clients);
            const l = one(t.leads);
            const overdue = t.due_date && t.due_date < today && t.status !== "facut";
            return (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="min-w-0">
                  <div className={`font-medium ${t.status === "facut" ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</div>
                  <div className="text-xs text-slate-500">
                    {c ? <Link className="text-indigo-700 hover:underline" href={`/clienti/${c.id}`}>{c.name}</Link> : null}
                    {!c && l ? <Link className="text-indigo-700 hover:underline" href={`/lead-uri/${l.id}`}>{l.store_name}</Link> : null}
                    {(c || l) ? " · " : ""}
                    {one(t.profiles)?.full_name ?? "Nealocat"}
                    {t.auto_generated ? " · generat automat" : ""}
                  </div>
                  {t.description ? <div className="mt-0.5 text-xs text-slate-500">{t.description}</div> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${overdue ? "font-medium text-red-600" : "text-slate-500"}`}>{fmtDate(t.due_date)}{overdue ? " · restant" : ""}</span>
                  <Badge value={t.priority}>{PRIORITY[t.priority]}</Badge>
                  <Badge value={t.status}>{TASK_STATUS[t.status]}</Badge>
                  {write ? (
                    <form action={setTaskStatus} className="flex gap-1">
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="id" value={t.id} />
                      {t.status === "facut" ? (
                        <button name="status" value="de_facut" className={btnSmall}>Redeschide</button>
                      ) : (
                        <>
                          {t.status === "de_facut" ? <button name="status" value="in_lucru" className={btnSmall}>Începe</button> : null}
                          <button name="status" value="facut" className={btnSmall}>Făcut</button>
                          <button name="status" value="anulat" className={btnSmall}>Anulează</button>
                        </>
                      )}
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
