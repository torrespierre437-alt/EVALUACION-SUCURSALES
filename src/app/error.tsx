"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Algo salió mal</h1>
          <p className="mt-1 text-sm text-slate-500">
            No pudimos cargar esta página. Puede ser un problema de conexión — intenta de nuevo.
          </p>
        </div>
        <button
          onClick={reset}
          className="w-full rounded-md bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Reintentar
        </button>
        <a href="/" className="block text-xs text-slate-400 underline">
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
