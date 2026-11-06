import { signIn, signUp } from "@/app/actions";
import { Flash, Field, inputCls, btnCls } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ ok?: string; eroare?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Creative Rapide</h1>
          <p className="text-sm text-slate-500">CRM intern</p>
        </div>
        <Flash sp={sp} />

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Autentificare</h2>
          <form action={signIn} className="space-y-4">
            <Field label="Email">
              <input name="email" type="email" required autoComplete="email" className={inputCls} />
            </Field>
            <Field label="Parolă">
              <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
            </Field>
            <button className={`${btnCls} w-full`}>Intră în cont</button>
          </form>
        </div>

        <details className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Nu ai cont? Creează unul</summary>
          <p className="mt-3 text-xs text-slate-500">
            După crearea contului, un administrator trebuie să te aprobe și să îți dea un rol înainte să vezi date.
          </p>
          <form action={signUp} className="mt-4 space-y-4">
            <Field label="Nume complet">
              <input name="full_name" required minLength={2} className={inputCls} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" required autoComplete="email" className={inputCls} />
            </Field>
            <Field label="Parolă" hint="Minimum 8 caractere.">
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
            </Field>
            <button className={`${btnCls} w-full`}>Creează cont</button>
          </form>
        </details>
      </div>
    </div>
  );
}
