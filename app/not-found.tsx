import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="bg-gradient-to-br from-indigo-500 to-pink-400 bg-clip-text text-6xl font-semibold tracking-tight text-transparent">404</div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Pagina nu există</h1>
        <p className="mt-2 text-sm text-slate-600">Linkul e greșit sau pagina a fost ștearsă.</p>
        <Link href="/" className="mt-6 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Înapoi acasă</Link>
      </div>
    </div>
  );
}
