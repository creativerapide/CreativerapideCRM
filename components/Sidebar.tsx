"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/actions";

export type NavItem = { href: string; label: string; more?: boolean };

export default function Sidebar({
  items,
  name,
  roleLabel,
  showSearch,
}: {
  items: NavItem[];
  name: string;
  roleLabel: string;
  showSearch: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const link = (it: NavItem) => {
    const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
    return (
      <Link
        key={it.href}
        href={it.href}
        onClick={() => setOpen(false)}
        className={`block rounded-lg px-3 py-2 text-sm font-medium ${
          active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        {it.label}
      </Link>
    );
  };
  const main = items.filter((i) => !i.more);
  const more = items.filter((i) => i.more);
  const moreActive = more.some((i) => pathname.startsWith(i.href));

  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {main.map(link)}
      {more.length ? (
        <details open={moreActive} className="pt-2">
          <summary className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Mai multe</summary>
          <div className="mt-1 space-y-1 border-l border-slate-200 pl-2">{more.map(link)}</div>
        </details>
      ) : null}
    </nav>
  );

  const footer = (
    <div className="border-t border-slate-200 p-4">
      <div className="truncate text-sm font-medium text-slate-900">{name}</div>
      <div className="text-xs text-slate-500">{roleLabel}</div>
      <form action={signOut} className="mt-3">
        <button className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline">Deconectare</button>
      </form>
    </div>
  );

  return (
    <>
      {/* bară de sus pe mobil */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="text-sm font-semibold text-slate-900">Creative Rapide · CRM</span>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Meniu"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
        >
          {open ? "Închide" : "Meniu"}
        </button>
      </div>
      {open ? (
        <div className="fixed inset-x-0 top-[53px] z-20 max-h-[calc(100vh-53px)] overflow-y-auto border-b border-slate-200 bg-white shadow-lg lg:hidden">
          {showSearch ? <SearchBox /> : null}
          {nav}
          {footer}
        </div>
      ) : null}

      {/* bară laterală pe desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="px-5 py-5">
          <div className="text-base font-semibold text-slate-900">Creative Rapide</div>
          <div className="text-xs text-slate-500">CRM</div>
        </div>
        {showSearch ? <SearchBox /> : null}
        {nav}
        {footer}
      </aside>
    </>
  );
}

function SearchBox() {
  return (
    <form action="/clienti" className="px-3 pt-1">
      <input
        name="q"
        placeholder="Caută client…"
        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
    </form>
  );
}
