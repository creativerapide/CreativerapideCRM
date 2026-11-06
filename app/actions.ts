"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { autoOrderTotal } from "@/lib/constants";

/* ───────── utilitare ───────── */

function go(path: string, kind: "ok" | "eroare", msg: string): never {
  const p = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  const [base, q] = p.split("?");
  const sp = new URLSearchParams(q ?? "");
  sp.delete("ok");
  sp.delete("eroare");
  sp.set(kind, msg);
  redirect(`${base}?${sp.toString()}`);
}

function backOf(fd: FormData): string {
  return String(fd.get("back") ?? "/");
}

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
  if (error.code === "23514" && /pierdut_motiv/.test(error.message)) return "Completează motivul pierderii.";
  if (error.code === "P0001") return error.message;
  if (error.code === "23505") return "Înregistrarea există deja.";
  if (error.code === "23503") return "Înregistrarea este legată de alte date și nu poate fi modificată așa.";
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
const short = z.string().max(300, "Textul este prea lung.").nullable().optional();
const url = z
  .string()
  .max(2000)
  .refine((v) => /^https?:\/\/\S+$/i.test(v), "Link invalid (trebuie să înceapă cu https://).")
  .nullable()
  .optional();
const uuid = z.string().uuid("Selecție invalidă.").nullable().optional();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dată invalidă.")
  .nullable()
  .optional();
const email = z.email("Adresa de email nu este validă.").nullable().optional();
const money = z.preprocess(
  (v) => (v == null ? 0 : String(v).replace(",", ".")),
  z.coerce.number("Sumă invalidă.").min(0, "Suma nu poate fi negativă.").max(10_000_000),
);
const intNN = z.preprocess(
  (v) => (v == null ? undefined : v),
  z.coerce.number("Număr invalid.").int("Număr întreg necesar.").min(0, "Numărul nu poate fi negativ.").max(100000).optional(),
);
const oneOf = (vals: string[], msg: string) => z.string().refine((v) => vals.includes(v), msg);

/* ───────── autentificare ───────── */

export async function signIn(fd: FormData) {
  const supabase = await createClient();
  const o = obj(fd);
  const { error } = await supabase.auth.signInWithPassword({ email: String(o.email ?? ""), password: String(fd.get("password") ?? "") });
  if (error) go("/login", "eroare", "Email sau parolă greșite (sau emailul nu a fost confirmat).");
  redirect("/");
}

export async function signUp(fd: FormData) {
  const supabase = await createClient();
  const o = obj(fd);
  const parsed = parse(
    z.object({
      email: z.email("Adresa de email nu este validă."),
      full_name: z.string().min(2, "Scrie numele tău."),
    }),
    o,
    "/login",
  );
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) go("/login", "eroare", "Parola trebuie să aibă minimum 8 caractere.");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password,
    options: { data: { full_name: parsed.full_name } },
  });
  if (error) go("/login", "eroare", "Nu am putut crea contul: " + error.message);
  if (data.session) redirect("/");
  go("/login", "ok", "Cont creat. Confirmă emailul din mesajul primit, apoi autentifică-te.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/* ───────── lead-uri ───────── */

const leadSchema = z.object({
  store_name: z.string("Numele magazinului este obligatoriu.").min(1, "Numele magazinului este obligatoriu.").max(200),
  contact_name: short,
  email,
  phone: z.string().max(40).nullable().optional(),
  website: short,
  source: short,
  active_ads_count: intNN,
  email_variant: short,
  owner_id: uuid,
  next_step: short,
  next_step_at: date,
  notes: text,
});

export async function createLead(fd: FormData) {
  const back = backOf(fd);
  const { supabase, user } = await ctx();
  const v = parse(leadSchema, obj(fd), back);
  const { error } = await supabase.from("leads").insert({ ...v, owner_id: v.owner_id ?? user.id });
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Lead adăugat.");
}

export async function updateLead(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const id = parse(z.string().uuid(), fd.get("id"), back);
  const v = parse(leadSchema.partial().extend({ lost_reason: text }), obj(fd), back);
  const { error } = await supabase.from("leads").update(v).eq("id", id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Lead actualizat.");
}

export async function moveLead(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const o = obj(fd);
  const v = parse(
    z.object({
      id: z.string().uuid(),
      stage: oneOf(["raspuns_email", "contactat_whatsapp", "test_trimis", "client", "pierdut"], "Etapă invalidă."),
      lost_reason: text,
    }),
    o,
    back,
  );
  if (v.stage === "client") {
    const { data, error } = await supabase.rpc("convert_lead", { p_lead: v.id });
    if (error) go(back, "eroare", dbErr(error));
    revalidatePath("/", "layout");
    redirect(`/clienti/${data}?ok=${encodeURIComponent("Lead transformat în client. Completează detaliile.")}`);
  }
  if (v.stage === "pierdut" && !v.lost_reason) go(back, "eroare", "Completează motivul pierderii.");
  const { error } = await supabase
    .from("leads")
    .update({ stage: v.stage, lost_reason: v.stage === "pierdut" ? v.lost_reason : null })
    .eq("id", v.id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Etapa a fost actualizată.");
}

/* ───────── clienți ───────── */

const clientSchema = z.object({
  name: z.string("Numele clientului este obligatoriu.").min(1, "Numele clientului este obligatoriu.").max(200),
  website: short,
  category: short,
  platform: short,
  business_model: short,
  status: oneOf(["lead", "calificat", "test", "activ", "in_pauza", "inactiv", "pierdut"], "Status invalid.").optional(),
  source: short,
  acquired_at: date,
  owner_id: uuid,
  satisfaction: oneOf(["necunoscuta", "multumit", "neutru", "nemultumit"], "Valoare invalidă.").optional(),
  risk_level: oneOf(["scazut", "mediu", "ridicat"], "Valoare invalidă.").optional(),
  risk_reason: text,
  preferences: text,
  recurring_instructions: text,
  assets_url: url,
  lost_reason: text,
});

export async function createClientAction(fd: FormData) {
  const back = backOf(fd);
  const { supabase, user } = await ctx();
  const v = parse(clientSchema, obj(fd), back);
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...v, owner_id: v.owner_id ?? user.id })
    .select("id")
    .single();
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  redirect(`/clienti/${data.id}?ok=${encodeURIComponent("Client creat.")}`);
}

export async function updateClientAction(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const id = parse(z.string().uuid(), fd.get("id"), back);
  const v = parse(clientSchema, obj(fd), back);
  const patch: Record<string, unknown> = { ...v, archived: fd.get("archived") === "on" };
  if (v.status === "pierdut") patch.lost_at = todayISO();
  else {
    patch.lost_at = null;
    patch.lost_reason = null;
  }
  const { error } = await supabase.from("clients").update(patch).eq("id", id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Client actualizat.");
}

export async function addContact(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const v = parse(
    z.object({
      client_id: z.string().uuid(),
      name: z.string("Numele contactului este obligatoriu.").min(1, "Numele contactului este obligatoriu."),
      role: short,
      email,
      phone: z.string().max(40).nullable().optional(),
      preferred_channel: oneOf(["email", "whatsapp", "apel", "altul"], "Canal invalid.").nullable().optional(),
    }),
    obj(fd),
    back,
  );
  const { error } = await supabase.from("contacts").insert(v);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Contact adăugat.");
}

export async function addNote(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const v = parse(
    z.object({ client_id: z.string().uuid(), body: z.string("Scrie o notă.").min(1, "Scrie o notă.").max(4000) }),
    obj(fd),
    back,
  );
  const { error } = await supabase.from("client_notes").insert(v);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Notă adăugată.");
}

/* ───────── interacțiuni ───────── */

export async function logInteraction(fd: FormData) {
  const back = backOf(fd);
  const { supabase, user } = await ctx();
  const v = parse(
    z
      .object({
        client_id: uuid,
        lead_id: uuid,
        channel: oneOf(["email", "whatsapp", "apel", "intalnire", "altul"], "Canal invalid."),
        type: short,
        summary: z.string("Scrie un rezumat al discuției.").min(1, "Scrie un rezumat al discuției.").max(4000),
        client_state: short,
        feedback: text,
        issue: text,
        promise: text,
        promise_due: date,
        outcome: text,
        next_step: short,
        next_step_at: date,
      })
      .refine((d) => d.client_id || d.lead_id, { message: "Alege clientul sau lead-ul." }),
    obj(fd),
    back,
  );
  const { error } = await supabase.from("interactions").insert(v);
  if (error) go(back, "eroare", dbErr(error));

  if (v.lead_id && (v.next_step || v.next_step_at)) {
    await supabase.from("leads").update({ next_step: v.next_step ?? null, next_step_at: v.next_step_at ?? null }).eq("id", v.lead_id);
  }
  if (fd.get("make_task") === "on" && v.next_step) {
    await supabase.from("tasks").insert({
      title: v.next_step,
      due_date: v.next_step_at ?? null,
      client_id: v.client_id ?? null,
      lead_id: v.lead_id ?? null,
      assignee_id: user.id,
      auto_generated: true,
    });
  }
  revalidatePath("/", "layout");
  go(back, "ok", "Interacțiune salvată.");
}

export async function cancelInteraction(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const id = parse(z.string().uuid(), fd.get("id"), back);
  const { error } = await supabase.from("interactions").update({ cancelled: true }).eq("id", id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Interacțiunea a fost anulată.");
}

export async function togglePromise(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const id = parse(z.string().uuid(), fd.get("id"), back);
  const done = fd.get("done") === "1";
  const { error } = await supabase.from("interactions").update({ promise_done: done }).eq("id", id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", done ? "Promisiune marcată ca îndeplinită." : "Promisiune redeschisă.");
}

/* ───────── comenzi și creative ───────── */

const orderSchema = z.object({
  client_id: z.string("Alege clientul.").uuid("Alege clientul."),
  order_date: date,
  package: short,
  creatives_count: intNN,
  price_agreed: money,
  discount: money,
  deadline: date,
  editor_id: uuid,
  brief_url: url,
  assets_url: url,
  notes: text,
});

export async function createOrder(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const v = parse(orderSchema, obj(fd), back);
  const cnt = v.creatives_count ?? 0;
  let price = v.price_agreed;
  // calcul automat al prețului când nu a fost introdus: Standard 20 RON (19 la 50+), Plus 30, Performanță 35, Ofertă de start (2 la 10 RON, restul 20); pachetele personalizate se negociază
  if (price === 0 && cnt > 0 && cnt < 100) {
    const total = autoOrderTotal(v.package, cnt);
    if (total !== null) price = total;
  }
  if (v.discount > price) go(back, "eroare", "Discountul nu poate fi mai mare decât prețul.");
  const row = { ...v, creatives_count: cnt, price_agreed: price, order_date: v.order_date ?? todayISO() };
  const { data, error } = await supabase.from("orders").insert(row).select("id").single();
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  redirect(`/comenzi/${data.id}?ok=${encodeURIComponent("Comandă creată.")}`);
}

export async function updateOrder(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const id = parse(z.string().uuid(), fd.get("id"), back);
  const v = parse(
    orderSchema.partial().extend({
      status: oneOf(["noua", "brief_incomplet", "aprobata", "in_lucru", "verificare_qc", "revizii", "livrata", "anulata"], "Status invalid.").optional(),
      financial_status: oneOf(["neemisa", "facturata", "partial_incasata", "incasata"], "Status financiar invalid.").optional(),
      delivery_url: url,
    }),
    obj(fd),
    back,
  );
  const { error } = await supabase.from("orders").update(v).eq("id", id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Comandă actualizată.");
}

/** Editorii pot schimba doar statusul, linkul de livrare și observațiile. */
export async function updateOrderEditor(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const id = parse(z.string().uuid(), fd.get("id"), back);
  const v = parse(
    z.object({
      status: oneOf(["noua", "brief_incomplet", "aprobata", "in_lucru", "verificare_qc", "revizii", "livrata", "anulata"], "Status invalid."),
      delivery_url: url,
      notes: text,
    }),
    obj(fd),
    back,
  );
  const { error } = await supabase.from("orders").update(v).eq("id", id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Comandă actualizată.");
}

export async function addCreatives(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const v = parse(
    z.object({
      order_id: z.string().uuid(),
      count: z.coerce.number("Număr invalid.").int().min(1, "Minimum 1 creativ.").max(100, "Maximum 100 odată."),
      product: short,
      angle: short,
      editor_id: uuid,
      deadline: date,
    }),
    obj(fd),
    back,
  );
  const rows = Array.from({ length: v.count }, () => ({
    order_id: v.order_id,
    product: v.product ?? null,
    angle: v.angle ?? null,
    editor_id: v.editor_id ?? null,
    deadline: v.deadline ?? null,
  }));
  const { error } = await supabase.from("creatives").insert(rows);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", `${v.count} creative adăugate.`);
}

export async function bulkCreativeStatus(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const ids = fd.getAll("ids").map(String).filter(Boolean);
  if (!ids.length) go(back, "eroare", "Selectează cel puțin un creativ.");
  const status = parse(oneOf(["de_facut", "in_lucru", "verificare_qc", "revizii", "livrata", "anulata"], "Status invalid."), fd.get("status"), back);
  const { error } = await supabase.from("creatives").update({ status }).in("id", ids);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", `${ids.length} creative actualizate.`);
}

export async function updateCreative(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const id = parse(z.string().uuid(), fd.get("id"), back);
  const v = parse(
    z.object({
      product: short,
      angle: short,
      source_url: url,
      delivery_url: url,
      feedback: text,
      revisions: intNN,
      status: oneOf(["de_facut", "in_lucru", "verificare_qc", "revizii", "livrata", "anulata"], "Status invalid.").optional(),
    }),
    obj(fd),
    back,
  );
  const patch: Record<string, unknown> = { ...v };
  if (fd.get("qc") === "1") {
    patch.qc_checklist = {
      audio: fd.get("qc_audio") === "on",
      text: fd.get("qc_text") === "on",
      format: fd.get("qc_format") === "on",
      greseli: fd.get("qc_greseli") === "on",
    };
  }
  const { error } = await supabase.from("creatives").update(patch).eq("id", id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Creativ actualizat.");
}

/* ───────── taskuri ───────── */

export async function createTask(fd: FormData) {
  const back = backOf(fd);
  const { supabase, user } = await ctx();
  const v = parse(
    z.object({
      title: z.string("Scrie titlul taskului.").min(1, "Scrie titlul taskului.").max(300),
      description: text,
      due_date: date,
      priority: oneOf(["scazuta", "normala", "ridicata", "urgenta"], "Prioritate invalidă.").optional(),
      assignee_id: uuid,
      client_id: uuid,
      lead_id: uuid,
      order_id: uuid,
    }),
    obj(fd),
    back,
  );
  const { error } = await supabase.from("tasks").insert({ ...v, assignee_id: v.assignee_id ?? user.id });
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Task creat.");
}

export async function setTaskStatus(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx();
  const id = parse(z.string().uuid(), fd.get("id"), back);
  const status = parse(oneOf(["de_facut", "in_lucru", "facut", "anulat"], "Status invalid."), fd.get("status"), back);
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Task actualizat.");
}

/* ───────── utilizatori (admin) ───────── */

export async function updateUser(fd: FormData) {
  const back = "/setari";
  const { supabase, user } = await ctx();
  const v = parse(
    z.object({
      id: z.string().uuid(),
      role: oneOf(["admin", "account_manager", "editor", "viewer"], "Rol invalid."),
      full_name: short,
    }),
    obj(fd),
    back,
  );
  const active = fd.get("active") === "on";
  if (v.id === user.id && (v.role !== "admin" || !active)) go(back, "eroare", "Nu îți poți scoate singur accesul de administrator.");
  const { error } = await supabase.from("profiles").update({ role: v.role, active, full_name: v.full_name }).eq("id", v.id);
  if (error) go(back, "eroare", dbErr(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Utilizator actualizat.");
}
