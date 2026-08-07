"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-slate-500">
            Escribe el correo con el que inicias sesión y te mandamos un link para poner una contraseña nueva.
          </p>
        </div>

        {status === "sent" ? (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            Si ese correo tiene una cuenta, te llegó un link para restablecer tu contraseña. Revisa tu bandeja
            (y spam).
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {status === "error" && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                Algo falló al enviar el correo. Intenta de nuevo.
              </p>
            )}
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Correo
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {status === "sending" ? "Enviando..." : "Enviar link"}
            </button>
          </form>
        )}

        <Link href="/login" className="block text-center text-xs text-slate-500 underline">
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
