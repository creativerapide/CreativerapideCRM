import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, requireActive } from "@/lib/session";
import { Badge, Card, Empty, Field, PageHeader, Select, btnCls, btnGhost, td, th } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { Row, SP } from "@/lib/types";

const TABLES: Record<string, string> = {
  clients: "Clienți",
  leads: "Lead-uri",
  orders: "Comenzi",
  creatives: "Creative",
  invoices: "Facturi",
  payments: "Încasări",
  costs: "Costuri",
  profiles: "Utilizatori",
};
const ACTIONS: Record<string, string> = { INSERT: "Creat", UPDATE: "Modificat", DELETE: "Șters" };
const IGNORE = new Set(["updated_at", "created_at"]);

function changedKeys(oldD: Row | null, newD: Row | null): string[] {
  if (!oldD || !newD) return [];
  return Object.keys(newD).filter((k) => !IGNORE.has(k) && JSON.stringify(oldD[k]) !== JSON.stringify(newD[k]));
}

export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  if (!isAdmin(profile)) redirect("/");
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("audit_log").select("id, table_name, record_id, action, changed_by, changed_at, old_data, new_data").order("changed_at", { ascending: false }).limit(200);
  if (sp.tabel && TABLES[sp.tabel]) query = query.eq("table_name", sp.tabel);
  const [logR, usersR] = await Promise.all([query, supabase.from("profiles").select("id, full_name")]);
  const rows: Row[] = logR.data ?? [];
  const who = new Map<string, string>((usersR.data ?? []).map((u: Row) => [u.id, u.full_name]));

  const label = (r: Row): string => {
    const d = (r.new_data ?? r.old_data) as Row | null;
    return d?.name ?? d?.store_name ?? d?.number?.toString() ?? d?.client_name ?? d?.full_name ?? String(r.record_id).slice(0, 8);
  };

  return (
    <>
      <PageHeader title="Jurnal de modificări" subtitle="Ultimele 200 de modificări importante: cine, ce și când." actions={<Link href="/setari" className={btnGhost}>← Setări</Link>} />
      <form action="/setari/audit" className="mb-4 flex items-end gap-3">
        <Field label="Tabel" className="w-56"><Select name="tabel" options={TABLES} defaultValue={sp.tabel ?? ""} empty="Toate" /></Field>
        <button className={btnCls}>Filtrează</button>
      </form>
      <Card>
        {rows.length === 0 ? (
          <Empty text="Nicio modificare înregistrată." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead><tr><th className={th}>Când</th><th className={th}>Cine</th><th className={th}>Ce</th><th className={th}>Înregistrare</th><th className={th}>Câmpuri modificate</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const keys = r.action === "UPDATE" ? changedKeys(r.old_data, r.new_data) : [];
                  return (
                    <tr key={r.id}>
                      <td className={td}>{fmtDateTime(r.changed_at)}</td>
                      <td className={td}>{r.changed_by ? (who.get(r.changed_by) ?? "—") : "Sistem"}</td>
                      <td className={td}>
                        <Badge tone={r.action === "DELETE" ? "red" : r.action === "INSERT" ? "green" : "slate"}>{ACTIONS[r.action]}</Badge>{" "}
                        {TABLES[r.table_name] ?? r.table_name}
                      </td>
                      <td className={td}>{label(r)}</td>
                      <td className={`${td} text-xs text-slate-500`}>{keys.length ? keys.join(", ") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
