import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession, isStaff } from "@/lib/session";
import { CLIENT_STATUS, RISK, SATISFACTION } from "@/lib/constants";
import { fmtDate } from "@/lib/format";

function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  // previne injecția de formule în Excel
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const profile = await getSession();
  if (!profile || !isStaff(profile)) return new NextResponse("Fără permisiune.", { status: 403 });

  const supabase = await createClient();
  const [clientsR, statsR, usersR] = await Promise.all([
    supabase.from("clients").select("id, name, website, category, platform, status, source, owner_id, satisfaction, risk_level, risk_reason, acquired_at").order("name"),
    supabase.from("client_stats").select("*"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const stats = new Map((statsR.data ?? []).map((s) => [s.client_id as string, s]));
  const users = new Map((usersR.data ?? []).map((u) => [u.id as string, u.full_name as string]));

  const header = ["Client", "Website", "Categorie", "Platformă", "Status", "Sursă", "Responsabil", "Satisfacție", "Risc", "Motiv risc", "Data achiziției", "Comenzi", "Creative", "Venit (RON)", "Prima comandă", "Ultima comandă", "Ultima discuție"];
  const rows = (clientsR.data ?? []).map((c) => {
    const s = stats.get(c.id);
    return [
      c.name, c.website, c.category, c.platform, CLIENT_STATUS[c.status] ?? c.status, c.source,
      c.owner_id ? users.get(c.owner_id) : "", SATISFACTION[c.satisfaction] ?? c.satisfaction, RISK[c.risk_level] ?? c.risk_level, c.risk_reason,
      fmtDate(c.acquired_at), s?.orders_count ?? 0, s?.creatives_count ?? 0, s?.revenue_total ?? 0,
      fmtDate(s?.first_order_date), fmtDate(s?.last_order_date), fmtDate(s?.last_interaction_at),
    ];
  });
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clienti-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
