"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">⚠️</div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Ceva nu a mers bine</h1>
        <p className="mt-2 text-sm text-slate-600">A apărut o eroare neașteptată. Încearcă din nou; dacă se repetă, spune-i lui Erick.</p>
        {error.digest ? <p className="mt-2 text-xs text-slate-500">Cod: {error.digest}</p> : null}
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => reset()} className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Încearcă din nou</button>
          <a href="/" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Acasă</a>
        </div>
      </div>
    </div>
  );
}
