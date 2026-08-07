export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Página no encontrada</h1>
          <p className="mt-1 text-sm text-slate-500">Revisa el link o vuelve al inicio.</p>
        </div>
        <a
          href="/"
          className="block w-full rounded-md bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
