import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { signOut } from "@/app/actions";
import { btnGhost } from "@/components/ui";

export default async function Asteptare() {
  const p = await requireProfile();
  if (p.active) redirect("/");
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Contul așteaptă aprobarea</h1>
        <p className="mt-2 text-sm text-slate-600">
          Contul <strong>{p.email}</strong> a fost creat, dar un administrator trebuie să îl activeze și să îți dea un rol.
          Spune-i lui Erick să te aprobe din Setări, apoi reîncarcă pagina.
        </p>
        <form action={signOut} className="mt-6">
          <button className={btnGhost}>Deconectare</button>
        </form>
      </div>
    </div>
  );
}
