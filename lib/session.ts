import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "account_manager" | "editor" | "viewer";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  active: boolean;
  finance_access: boolean;
};

export const getSession = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active, finance_access")
    .eq("id", user.id)
    .single();
  return (data as Profile | null) ?? null;
});

export async function requireProfile(): Promise<Profile> {
  const p = await getSession();
  if (!p) redirect("/login");
  return p;
}

/** Cere un profil activ; altfel trimite la pagina de așteptare. */
export async function requireActive(): Promise<Profile> {
  const p = await requireProfile();
  if (!p.active) redirect("/asteptare");
  return p;
}

export const isAdmin = (p: Profile) => p.active && p.role === "admin";
export const isStaff = (p: Profile) => p.active && (p.role === "admin" || p.role === "account_manager");
export const canRead = (p: Profile) => p.active && p.role !== "editor";
/** Acces la facturi, încasări și costuri: adminul și account managerii cu drept financiar. */
export const hasFinance = (p: Profile) => p.active && (p.role === "admin" || (p.role === "account_manager" && p.finance_access));
