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
  const { data: inv } = await supabase.from("invoices").select("id").eq("order_id", id.data);
  if (inv?.length) {
    const { error: e1 } = await supabase.from("invoices").delete().eq("order_id", id.data);
    if (e1) back(id.data, "Nu am putut șterge facturile comenzii: " + e1.message);
  }
  const { data, error } = await supabase.from("orders").delete().eq("id", id.data).select("id");
  if (error) back(id.data, "Eroare: " + error.message);
  if (!data?.length) back(id.data, "Doar administratorul poate șterge comenzi.");
  revalidatePath("/", "layout");
  redirect(`/comenzi?ok=${encodeURIComponent("Comanda a fost ștearsă.")}`);
}
