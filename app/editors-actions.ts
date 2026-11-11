"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasFinance, requireActive } from "@/lib/session";
import { todayISO } from "@/lib/format";

/* Editorii nu au cont în CRM: sunt simple înregistrări (nume + tarif pe creativă).
   Pe fiecare comandă se trece cine a făcut câte creative și la ce tarif. Doar cine are acces financiar. */

function go(path: string, kind: "ok" | "eroare", msg: string): never {
  const p = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  const [base, q] = p.split("?");
  const sp = new URLSearchParams(q ?? "");
  sp.delete("ok");
  sp.delete("eroare");
  sp.set(kind, msg);
  redirect(`${base}?${sp.toString()}`);
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

async function guard(back: string) {
  const profile = await requireActive();
  if (!hasFinance(profile)) go(back, "eroare", "Nu ai acces la rubrica Editori.");
  const supabase = await createClient();
  return supabase;
}

const money = z.preprocess(
  (v) => (v == null ? undefined : String(v).replace(",", ".")),
  z.coerce.number("Introdu o sumă validă.").min(0, "Suma nu poate fi negativă.").max(100000, "Sumă prea mare."),
);
const optMoney = z.preprocess(
  (v) => (v == null ? undefined : String(v).replace(",", ".")),
  z.coerce.number("Introdu o sumă validă.").min(0, "Suma nu poate fi negativă.").max(100000, "Sumă prea mare.").optional(),
);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dată invalidă.").nullable().optional();

/** Tarif din: tarif introdus, sau sumă totală / creative, sau tariful implicit al editorului. */
async function resolveRate(supabase: Awaited<ReturnType<typeof createClient>>, back: string, editorId: string, creatives: number, rate?: number, total?: number) {
  if (total !== undefined) return Math.round((total / creatives) * 10000) / 10000;
  if (rate !== undefined) return rate;
  const { data: ed } = await supabase.from("editors").select("rate").eq("id", editorId).maybeSingle();
  if (!ed) go(back, "eroare", "Editorul nu există.");
  return Number(ed.rate);
}

export async function createEditor(fd: FormData) {
  const back = "/editori";
  const supabase = await guard(back);
  const v = parse(
    z.object({
      name: z.string("Scrie numele editorului.").min(1, "Scrie numele editorului.").max(80),
      rate: money,
      notes: z.string().max(500).nullable().optional(),
    }),
    obj(fd),
    back,
  );
  const { error } = await supabase.from("editors").insert(v);
  if (error) go(back, "eroare", "Eroare: " + error.message);
  revalidatePath("/editori");
  go(back, "ok", `Editor adăugat: ${v.name}.`);
}

export async function updateEditor(fd: FormData) {
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) redirect("/editori");
  const back = `/editori/${id.data}`;
  const supabase = await guard(back);
  const v = parse(
    z.object({
      name: z.string("Scrie numele editorului.").min(1, "Scrie numele editorului.").max(80),
      rate: money,
      notes: z.string().max(500).nullable().optional(),
    }),
    obj(fd),
    back,
  );
  const { error } = await supabase
    .from("editors")
    .update({ ...v, active: fd.get("active") === "on" })
    .eq("id", id.data);
  if (error) go(back, "eroare", "Eroare: " + error.message);
  revalidatePath("/editori", "layout");
  go(back, "ok", "Editor salvat. Tariful nou se aplică doar la lucrările adăugate de acum.");
}

/** Pe o comandă: cine a făcut câte creative. Tariful gol = tariful implicit al editorului. */
export async function addEditorWork(fd: FormData) {
  const back = String(fd.get("back") ?? "/comenzi");
  const supabase = await guard(back);
  const v = parse(
    z.object({
      order_id: z.string("Comandă invalidă.").uuid("Comandă invalidă."),
      editor_id: z.string("Alege editorul.").uuid("Alege editorul."),
      creatives: z.preprocess((x) => (x == null ? undefined : Number(x)), z.number("Scrie câte creative.").int("Număr întreg.").min(1, "Minim 1 creativă.").max(1000)),
      rate: optMoney,
      total: optMoney,
      work_date: dateStr,
      notes: z.string().max(300).nullable().optional(),
    }),
    obj(fd),
    back,
  );
  const rate = await resolveRate(supabase, back, v.editor_id, v.creatives, v.rate, v.total);
  const { error } = await supabase.from("editor_work").insert({
    order_id: v.order_id,
    editor_id: v.editor_id,
    creatives: v.creatives,
    rate,
    work_date: v.work_date ?? todayISO(),
    notes: v.notes ?? null,
  });
  if (error) go(back, "eroare", "Eroare: " + error.message);
  revalidatePath("/", "layout");
  go(back, "ok", "Lucrare adăugată pentru editor.");
}

export async function deleteEditorWork(fd: FormData) {
  const back = String(fd.get("back") ?? "/editori");
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) go(back, "eroare", "Înregistrare invalidă.");
  const supabase = await guard(back);
  const { error } = await supabase.from("editor_work").delete().eq("id", id.data);
  if (error) go(back, "eroare", "Eroare: " + error.message);
  revalidatePath("/", "layout");
  go(back, "ok", "Lucrare ștearsă.");
}

/** Lucrări trecute manual (fără comandă): ce a făcut editorul până acum. */
export async function addManualWork(fd: FormData) {
  const back = "/editori";
  const supabase = await guard(back);
  const v = parse(
    z.object({
      editor_id: z.string("Alege editorul.").uuid("Alege editorul."),
      creatives: z.preprocess((x) => (x == null ? undefined : Number(x)), z.number("Scrie câte creative.").int("Număr întreg.").min(1, "Minim 1 creativă.").max(10000)),
      rate: optMoney,
      total: optMoney,
      work_date: dateStr,
      notes: z.string().max(300).nullable().optional(),
    }),
    obj(fd),
    back,
  );
  const rate = await resolveRate(supabase, back, v.editor_id, v.creatives, v.rate, v.total);
  const { error } = await supabase.from("editor_work").insert({
    order_id: null,
    editor_id: v.editor_id,
    creatives: v.creatives,
    rate,
    work_date: v.work_date ?? todayISO(),
    notes: v.notes ?? "Adăugat manual",
  });
  if (error) go(back, "eroare", "Eroare: " + error.message);
  revalidatePath("/", "layout");
  go(back, "ok", "Creative adăugate manual.");
}

/** Modifică o lucrare deja trecută (greșeli). Sumă totală completată = tariful se calculează din ea. */
export async function updateEditorWork(fd: FormData) {
  const back = String(fd.get("back") ?? "/editori");
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) go(back, "eroare", "Înregistrare invalidă.");
  const supabase = await guard(back);
  const v = parse(
    z.object({
      creatives: z.preprocess((x) => (x == null ? undefined : Number(x)), z.number("Scrie câte creative.").int("Număr întreg.").min(1, "Minim 1 creativă.").max(10000)),
      rate: optMoney,
      total: optMoney,
      work_date: dateStr,
      notes: z.string().max(300).nullable().optional(),
    }),
    obj(fd),
    back,
  );
  const { data: cur } = await supabase.from("editor_work").select("editor_id, rate").eq("id", id.data).maybeSingle();
  if (!cur) go(back, "eroare", "Lucrarea nu mai există.");
  const rate = v.total !== undefined ? Math.round((v.total / v.creatives) * 10000) / 10000 : (v.rate ?? Number(cur.rate));
  const { error } = await supabase
    .from("editor_work")
    .update({ creatives: v.creatives, rate, work_date: v.work_date ?? todayISO(), notes: v.notes ?? null })
    .eq("id", id.data);
  if (error) go(back, "eroare", "Eroare: " + error.message);
  revalidatePath("/", "layout");
  go(back, "ok", "Lucrare modificată.");
}
