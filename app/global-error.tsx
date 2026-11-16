"use client";

import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ro">
      <body>
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Eroare în aplicație</h1>
            <p className="mt-2 text-sm text-slate-600">Reîncarcă pagina. Dacă se repetă, spune-i lui Erick.</p>
            <button onClick={() => reset()} className="mt-6 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Reîncarcă</button>
          </div>
        </div>
      </body>
    </html>
  );
}
