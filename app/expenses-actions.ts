"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";

function go(path: string, kind: "ok" | "eroare", msg: string): never {
  const p = path.startsWith("/") && !path.startsWith("//") ? path : "/cheltuieli";
  const [base, q] = p.split("?");
  const sp = new URLSearchParams(q ?? "");
  sp.delete("ok");
  sp.delete("eroare");
  sp.set(kind, msg);
  redirect(`${base}?${sp.toString()}`);
}

const backOf = (fd: FormData) => String(fd.get("back") ?? "/cheltuieli");

function obj(fd: FormData) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    o[k] = t === "" ? null : t;
  }
  return o;
}

async function ctx(back: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, back };
}

const amount = z
  .string("Completează suma.")
  .transform((s) => Number(s.replace(",", ".")))
  .refine((n) => Number.isFinite(n) && n > 0 && n < 100000000, "Suma trebuie să fie un număr pozitiv.");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dată invalidă.")
  .nullable()
  .optional();

function dbMsg(e: { message: string; code?: string }) {
  if (e.code === "42501" || /row-level security/i.test(e.message)) return "Nu ai permisiunea pentru această acțiune.";
  return "Eroare: " + e.message;
}

export async function addExpense(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx(back);
  const r = z
    .object({
      description: z.string("Scrie pe ce ai cheltuit.").min(2, "Scrie pe ce ai cheltuit.").max(300),
      category: z.enum(["reclame", "software", "taxe", "colaboratori", "echipament", "altele"]).nullable().optional(),
      amount,
      spent_on: date,
      paid_from: z.enum(["transfer", "card"], "Alege: cont firmă sau card."),
    })
    .safeParse(obj(fd));
  if (!r.success) go(back, "eroare", r.error.issues[0]?.message ?? "Date invalide.");
  const v = r.data;
  const { error } = await supabase.from("expenses").insert({ ...v, spent_on: v.spent_on ?? todayISO() });
  if (error) go(back, "eroare", dbMsg(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Cheltuială adăugată.");
}

export async function deleteExpense(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx(back);
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) go(back, "eroare", "Selecție invalidă.");
  await supabase.from("expenses").delete().eq("id", id.data);
  const { data: still } = await supabase.from("expenses").select("id").eq("id", id.data).maybeSingle();
  if (still) go(back, "eroare", "Doar administratorul poate șterge cheltuieli.");
  revalidatePath("/", "layout");
  go(back, "ok", "Cheltuială ștearsă.");
}

export async function addWithdrawal(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx(back);
  const r = z
    .object({
      amount,
      taken_on: date,
      note: z.string().max(300).nullable().optional(),
    })
    .safeParse(obj(fd));
  if (!r.success) go(back, "eroare", r.error.issues[0]?.message ?? "Date invalide.");
  const v = r.data;
  const { error } = await supabase.from("withdrawals").insert({ ...v, taken_on: v.taken_on ?? todayISO() });
  if (error) go(back, "eroare", dbMsg(error));
  revalidatePath("/", "layout");
  go(back, "ok", "Extragere adăugată.");
}

export async function deleteWithdrawal(fd: FormData) {
  const back = backOf(fd);
  const { supabase } = await ctx(back);
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) go(back, "eroare", "Selecție invalidă.");
  await supabase.from("withdrawals").delete().eq("id", id.data);
  const { data: still } = await supabase.from("withdrawals").select("id").eq("id", id.data).maybeSingle();
  if (still) go(back, "eroare", "Doar administratorul poate șterge extrageri.");
  revalidatePath("/", "layout");
  go(back, "ok", "Extragere ștearsă.");
}
