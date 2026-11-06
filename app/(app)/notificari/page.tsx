import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActive } from "@/lib/session";
import { Card, Empty, Flash, PageHeader, btnCls, btnSmall } from "@/components/ui";
import { markAllNotificationsRead, markNotificationRead } from "@/app/stage2-actions";
import { fmtDateTime } from "@/lib/format";
import type { Row, SP } from "@/lib/types";

export default async function NotificationsPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireActive();
  if (profile.role === "editor") redirect("/comenzi");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("id, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(100);
  const items: Row[] = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader
        title="Notificări"
        subtitle="Generate zilnic de automatizări: follow-up după livrare, clienți fără comandă, lead-uri fără contact, promisiuni depășite, facturi restante."
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <input type="hidden" name="back" value="/notificari" />
              <button className={btnCls}>Marchează toate ca citite</button>
            </form>
          ) : undefined
        }
      />
      <Flash sp={sp} />
      <Card>
        {items.length === 0 ? (
          <Empty text="Nu ai notificări. Automatizările rulează în fiecare dimineață, la 07:00." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id} className={`flex items-start justify-between gap-3 py-3 ${n.read_at ? "opacity-60" : ""}`}>
                <div>
                  <div className={`text-sm ${n.read_at ? "text-slate-700" : "font-semibold text-slate-900"}`}>{n.title}</div>
                  <div className="text-xs text-slate-500">{fmtDateTime(n.created_at)}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {n.link ? <Link className={btnSmall} href={n.link}>Deschide</Link> : null}
                  {!n.read_at ? (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="back" value="/notificari" />
                      <input type="hidden" name="id" value={n.id} />
                      <button className={btnSmall}>Citit</button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
