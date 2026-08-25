import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/manifest.json", "/sw.js"];

// Si Supabase no responde en este tiempo, dejamos pasar la petición en vez de
// colgar el middleware hasta que Vercel lo corte (MIDDLEWARE_INVOCATION_TIMEOUT).
// Cada página protegida vuelve a validar la sesión del lado del servidor, así
// que "fallar abierto" aquí es seguro: en el peor caso la página redirige a
// /login por su cuenta.
const AUTH_CHECK_TIMEOUT_MS = 5000;

export async function middleware(request: NextRequest) {
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  const isApiCron = request.nextUrl.pathname.startsWith("/api/cron");

  // Rutas públicas no necesitan checar sesión: evitamos la llamada de red a
  // Supabase por completo para estas.
  if (isPublic || isApiCron) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("supabase auth timeout")), AUTH_CHECK_TIMEOUT_MS)
    );
    const result = await Promise.race([supabase.auth.getUser(), timeout]);
    user = result.data.user;
  } catch {
    return response;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|LOGO.jpg).*)"],
};
