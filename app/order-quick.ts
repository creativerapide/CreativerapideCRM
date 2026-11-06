"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

function dest(fd: FormData, kind: "ok" | "eroare", msg: string): never {
  const raw = String(fd.get("back") ?? "/comenzi");
  const p = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/comenzi";
  const [base, q] = p.split("?");
  const sp = new URLSearchParams(q ?? "");
  sp.delete("ok");
  sp.delete("eroare");
  sp.set(kind, msg);
  redirect(`${base}?${sp.toString()}`);
}

/** Marchează comanda ca trimisă (livrată), independent de încasare. Cu `undo=1` o readuce în „În lucru”. */
export async function markOrderSent(fd: FormData) {
  const id = z.string().uuid().safeParse(fd.get("order_id"));
  if (!id.success) dest(fd, "eroare", "Comandă invalidă.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const undo = fd.get("undo") === "1";
  if (!undo) {
    // Baza de date cere ca toate creativele să fie livrate înainte de comandă.
    const { error: cErr } = await supabase
      .from("creatives")
      .update({ status: "livrata" })
      .eq("order_id", id.data)
      .not("status", "in", "(livrata,anulata)");
    if (cErr) dest(fd, "eroare", "Eroare la creative: " + cErr.message);
  }
  const { data, error } = await supabase
    .from("orders")
    .update({ status: undo ? "in_lucru" : "livrata" })
    .eq("id", id.data)
    .select("id, number");
  if (error) dest(fd, "eroare", "Eroare: " + error.message);
  if (!data?.length) dest(fd, "eroare", "Nu ai drept să modifici această comandă.");
  revalidatePath("/", "layout");
  dest(fd, "ok", undo ? `Comanda #${data[0].number} a revenit în lucru.` : `Comanda #${data[0].number} marcată ca trimisă.`);
}
