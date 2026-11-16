"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

function back(id: string, msg: string): never {
  redirect(`/comenzi/${id}?eroare=${encodeURIComponent(msg)}`);
}

/** Șterge definitiv o comandă (și creativele ei). Doar administratorul; șterge și facturile/încasările legate de ea. */
export async function deleteOrder(fd: FormData) {
  const id = z.string().uuid().safeParse(fd.get("id"));
  if (!id.success) redirect("/comenzi");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (fd.get("confirm") !== "on") back(id.data, "Bifează confirmarea ca să ștergi comanda.");

  // facturile legate de comandă (și încasările lor) se șterg împreună cu ea
  const { error: e1 } = await supabase.from("invoices").delete().eq("order_id", id.data);
  const { error: e2 } = await supabase.from("orders").delete().eq("id", id.data);

  // nu ne luăm după răspunsul DELETE (poate veni gol chiar dacă s-a șters): verificăm direct dacă mai există
  const { data: still } = await supabase.from("orders").select("id").eq("id", id.data).maybeSingle();
  if (still) {
    const why = e2?.message ?? e1?.message;
    back(id.data, why ? "Nu am putut șterge comanda: " + why : "Doar administratorul poate șterge comenzi.");
  }
  revalidatePath("/", "layout");
  redirect(`/comenzi?ok=${encodeURIComponent("Comanda a fost ștearsă.")}`);
}
