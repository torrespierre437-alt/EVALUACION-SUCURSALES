"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  useEffect(() => {
    const supabase = createClient();
    // El link de recuperación deja a supabase-js en un estado "PASSWORD_RECOVERY";
    // hasta que eso ocurra no hay sesión válida para cambiar la contraseña.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      return;
    }
    setStatus("done");
    setTimeout(() => router.push("/"), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-slate-500">Escribe la contraseña que quieres usar de ahora en adelante.</p>
        </div>

        {!ready ? (
          <p className="text-sm text-slate-500">Verificando el link...</p>
        ) : status === "done" ? (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            Contraseña actualizada. Redirigiendo...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {status === "error" && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                No se pudo guardar (mínimo 6 caracteres). Intenta de nuevo.
              </p>
            )}
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Contraseña nueva
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {status === "saving" ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
