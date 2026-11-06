"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";

/* ───────── utilitare (aceleași reguli ca în actions.ts) ───────── */

function go(path: string, kind: "ok" | "eroare", msg: string): never {
  const p = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  const [base, q] = p.split("?");
  const sp = new URLSearchParams(q ?? "");
  sp.delete("ok");
  sp.delete("eroare");
  sp.set(kind, msg);
  redirect(`${base}?${sp.toString()}`);
}

const backOf = (fd: FormData): string => String(fd.get("back") ?? "/");

function obj(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    o[k] = t === "" ? null : t;
  }
  return o;
}

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown, back: string): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) go(back, "eroare", r.error.issues[0]?.message ?? "Date invalide.");
  return r.data;
}

function dbErr(error: { message: string; code?: string }): string {
  if (error.code === "42501" || /row-level security/i.test(error.message)) return "Nu ai permisiunea pentru această acțiune.";
  if (error.code === "23505" && /number/.test(error.message)) return "Există deja o factură cu acest număr.";
  if (error.code === "23505") return "Înregistrarea există deja.";
  if (error.code === "P0001") return error.message;
  if (error.code === "23503") return "Înregistrarea este legată de alte date.";
  return "Eroare: " + error.message;
}

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const text = z.string().max(4000, "Textul este prea lung.").nullable().optional();
const uuid = z.string().uuid("Selecție invalidă.").nullable().optional();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dată invalidă.")
  .nullable()
  .optional();
const amountPos = z.preprocess(
  (v) => (v == null ? undefined : String(v).replace(",", ".")),
  z.coerce.number("Introdu o sumă validă.").gt(0, "Suma trebuie să fie mai mare ca 0.").max(10_000_000, "Sumă prea mare."),
);
const amountNN = z.preprocess(
  (v) => (v == null ? undefined : String(v).replace(",", ".")),
  z.coerce.number("Introdu o sumă validă.").min(0, "Suma nu poate fi negativă.").max(10_000_000, "Sumă prea mare."),
);
const oneOf = (vals: string[], msg: string) => z.string().refine((v) => vals.includes(v), msg);

/* ───────── finanțe ───────── */

export async function createInvoice(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const v = parse(
    z.object({
      number: z.string("Introdu numărul facturii.").min(1, "Introdu numărul facturii.").max(60),
      client_id: z.string("Alege clientul.").uuid("Alege clientul."),
      order_id: uuid,
      issue_date: date,
      due_date: date,
      amount: amountPos,
      notes: text,
    }),
    obj(fd),
    back,
  );
  const { error } = await supabase.from("invoices").insert({ ...v, issue_date: v.issue_date ?? todayISO() });
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Factură adăugată.");
}

export async function addPayment(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const v = parse(
    z.object({
      invoice_id: z.string("Alege factura.").uuid("Alege factura."),
      amount: amountPos,
      paid_on: date,
      method: oneOf(["transfer", "card", "numerar", "ramburs", "altul"], "Metodă invalidă.").optional(),
      notes: text,
    }),
    obj(fd),
    back,
  );
  const { error } = await supabase.from("payments").insert({ ...v, paid_on: v.paid_on ?? todayISO() });
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Încasare înregistrată.");
}

/** Un singur click: marchează comanda ca încasată (creează automat factura și plata). */
export async function markOrderPaid(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const v = parse(
    z.object({
      order_id: z.string("Alege comanda.").uuid("Alege comanda."),
      method: oneOf(["transfer", "card", "numerar", "ramburs", "altul"], "Metodă invalidă.").optional(),
      paid_on: date,
    }),
    obj(fd),
    back,
  );

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("id, number, client_id, total")
    .eq("id", v.order_id)
    .single();
  if (oErr || !order) go(back, "eroare", "Comanda nu a fost găsită.");
  const total = Number(order.total ?? 0);
  if (!(total > 0)) go(back, "eroare", "Comanda are totalul 0, nu poate fi încasată.");

  // factura existentă (neanulată) sau una nouă
  const { data: invs } = await supabase
    .from("invoices")
    .select("id, amount, payments(amount)")
    .eq("order_id", order.id)
    .neq("status", "anulata")
    .order("created_at", { ascending: true });
  let invoiceId: string | null = null;
  let toPay = total;
  if (invs && invs.length) {
    const inv = invs[0] as { id: string; amount: number | string; payments: { amount: number | string }[] | null };
    invoiceId = inv.id;
    const already = (inv.payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
    toPay = Number(inv.amount) - already;
  } else {
    let number = `CR-${order.number}`;
    for (let i = 0; i < 5; i++) {
      const { data: created, error } = await supabase
        .from("invoices")
        .insert({ number, client_id: order.client_id, order_id: order.id, amount: total, issue_date: v.paid_on ?? todayISO() })
        .select("id")
        .single();
      if (!error && created) {
        invoiceId = created.id;
        break;
      }
      if (error?.code === "23505") number = `CR-${order.number}-${i + 2}`;
      else go(back, "eroare", dbErr(error ?? { message: "necunoscută" }));
    }
  }
  if (!invoiceId) go(back, "eroare", "Nu am putut crea factura.");
  if (toPay > 0) {
    const { error } = await supabase
      .from("payments")
      .insert({ invoice_id: invoiceId, amount: toPay, paid_on: v.paid_on ?? todayISO(), method: v.method ?? "ramburs" });
    if (error) go(back, "eroare", dbErr(error));
  }
  revalidatePath("/", "layout");
  go(back, "ok", `Comanda #${order.number} este marcată ca încasată.`);
}

export async function cancelInvoice(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const id = parse(z.string().uuid(), fd.get("id"), back);
  const { error } = await supabase.from("invoices").update({ status: "anulata" }).eq("id", id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Factura a fost anulată.");
}

export async function addCost(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const v = parse(
    z.object({
      order_id: uuid,
      client_id: uuid,
      category: oneOf(["editor", "qc", "management", "alte"], "Categorie invalidă."),
      amount: amountNN,
      incurred_on: date,
      description: text,
    }),
    obj(fd),
    back,
  );
  const { error } = await supabase.from("costs").insert({ ...v, incurred_on: v.incurred_on ?? todayISO() });
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Cost adăugat.");
}

export async function deleteCost(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const id = parse(z.string().uuid(), fd.get("id"), back);
  const { data, error } = await supabase.from("costs").delete().eq("id", id).select("id");
  if (error) go(back, "eroare", dbErr(error));
  if (!data?.length) go(back, "eroare", "Doar administratorul poate șterge costuri.");
  revalidatePath("/", "layout");
  go(back, "ok", "Cost șters.");
}

/* ───────── notificări ───────── */

export async function markNotificationRead(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const id = parse(z.string().uuid(), fd.get("id"), back);
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  redirect(back);
}

export async function markAllNotificationsRead(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Toate notificările au fost marcate ca citite.");
}

/* ───────── utilizatori (admin), cu drept financiar ───────── */

export async function updateUserFull(fd: FormData) {
  const back = "/setari";
  const { supabase, user } = await ctx();
  const v = parse(
    z.object({
      id: z.string().uuid(),
      role: oneOf(["admin", "account_manager", "editor", "viewer"], "Rol invalid."),
      full_name: z.string().max(200).nullable().optional(),
    }),
    obj(fd),
    back,
  );
  const active = fd.get("active") === "on";
  const finance = fd.get("finance_access") === "on";
  if (v.id === user.id && (v.role !== "admin" || !active)) go(back, "eroare", "Nu îți poți scoate singur accesul de administrator.");
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: v.role, active, full_name: v.full_name, finance_access: finance })
    .eq("id", v.id)
    .select("id");
  if (error) go(back, "eroare", dbErr(error));
  if (!data?.length) go(back, "eroare", "Nu ai permisiunea să modifici utilizatori.");
  revalidatePath("/", "layout");
  go(back, "ok", "Utilizator actualizat.");
}

/* ───────── import de lead-uri ───────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function importLeads(fd: FormData) {
  const back = "/lead-uri/import";
  const { supabase, user } = await ctx();
  const raw = String(fd.get("date") ?? "");
  if (!raw.trim()) go(back, "eroare", "Lipește cel puțin un rând.");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 500) go(back, "eroare", "Maximum 500 de rânduri odată.");

  type Row = { store_name: string; email: string | null; phone: string | null; email_variant: string | null; active_ads_count: number | null };
  const rows: Row[] = [];
  let skipped = 0;
  const seen = new Set<string>();

  lines.forEach((line, i) => {
    const cells = line.split(/[;\t]|,(?=\s*[^\s])/).map((c) => c.trim());
    if (i === 0 && /magazin|email|store/i.test(cells[0] ?? "") && !EMAIL_RE.test(cells[1] ?? "")) return; // antet
    const [store, email, phone, variant, ads] = cells;
    const mail = email ? email.toLowerCase() : null;
    if (!store || (mail && !EMAIL_RE.test(mail)) || (!mail && !phone)) {
      skipped += 1;
      return;
    }
    if (mail && seen.has(mail)) {
      skipped += 1;
      return;
    }
    if (mail) seen.add(mail);
    const n = ads && /^\d+$/.test(ads) ? Number(ads) : null;
    rows.push({ store_name: store.slice(0, 200), email: mail, phone: phone ? phone.slice(0, 40) : null, email_variant: variant ? variant.slice(0, 60) : null, active_ads_count: n });
  });

  const emails = rows.map((r) => r.email).filter((e): e is string => Boolean(e));
  let existing = new Set<string>();
  if (emails.length) {
    const { data } = await supabase.from("leads").select("email").in("email", emails);
    existing = new Set((data ?? []).map((d) => String(d.email).toLowerCase()));
  }
  const fresh = rows.filter((r) => !r.email || !existing.has(r.email));
  skipped += rows.length - fresh.length;
  if (!fresh.length) go(back, "eroare", `Nu am importat nimic. Rânduri ignorate (duplicate sau date lipsă): ${skipped}.`);

  const { error } = await supabase.from("leads").insert(fresh.map((r) => ({ ...r, source: "email", owner_id: user.id })));
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", `Am importat ${fresh.length} lead-uri. Ignorate (duplicate sau date lipsă): ${skipped}.`);
}
