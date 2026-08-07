import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        action={login}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/LOGO.jpg" alt="PCP - Paquetería y Carga del Pacífico" className="mx-auto h-16 w-auto" />
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Evaluación de sucursales</h1>
          <p className="mt-1 text-sm text-slate-500">Inicia sesión con tu cuenta de sucursal o admin.</p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            No pudimos iniciar sesión. Verifica tu correo y contraseña.
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-brand px-3 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Entrar
        </button>

        <Link href="/forgot-password" className="block text-center text-xs text-slate-500 underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </div>
  );
}
