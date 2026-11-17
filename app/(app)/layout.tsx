import Sidebar, { type NavItem } from "@/components/Sidebar";
import { hasFinance, isStaff, requireActive } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireActive();

  let unread = 0;
  if (profile.role !== "editor") {
    const supabase = await createClient();
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    unread = count ?? 0;
  }

  const items: NavItem[] =
    profile.role === "editor"
      ? [{ href: "/comenzi", label: "Comenzile mele" }]
      : [
          { href: "/", label: "Acasă" },
          { href: "/comenzi", label: "Comenzi" },
          { href: "/clienti", label: "Clienți" },
          ...(hasFinance(profile) ? [{ href: "/finante", label: "Bani" }, { href: "/cheltuieli", label: "Cheltuieli" }, { href: "/editori", label: "Editori" }] : []),
          { href: "/lead-uri", label: "Lead-uri" },
          { href: "/taskuri", label: "Taskuri", more: true },
          { href: "/interactiuni", label: "Interacțiuni", more: true },
          ...(isStaff(profile) ? [{ href: "/lead-uri/import", label: "Import lead-uri", more: true }] : []),
          { href: "/rapoarte", label: "Rapoarte", more: true },
          { href: "/notificari", label: unread > 0 ? `Notificări (${unread})` : "Notificări", more: true },
          ...(profile.role === "admin" ? [{ href: "/setari", label: "Setări", more: true }] : []),
        ];

  return (
    <div className="min-h-screen">
      <Sidebar
        items={items}
        name={profile.full_name ?? profile.email ?? "Utilizator"}
        roleLabel={ROLES[profile.role]}
        showSearch={profile.role !== "editor"}
      />
      <main className="lg:pl-[16.5rem]">
        <div className="mx-auto w-full max-w-[2200px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 2xl:px-12">{children}</div>
      </main>
    </div>
  );
}
