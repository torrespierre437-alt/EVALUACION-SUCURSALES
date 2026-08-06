/**
 * Crea (o actualiza) una cuenta de Supabase Auth + su fila en `profiles` para cada
 * sucursal, y una cuenta admin. Usa la service_role key (bypassa RLS).
 *
 * Uso:
 *   1. Llena BRANCH_EMAILS abajo con el correo real de cada sucursal (o dínoslo
 *      y lo generamos por ti, ej. sucursal.bjx@tuempresa.com).
 *   2. Llena ADMIN_EMAIL con tu correo.
 *   3. npx tsx scripts/setup-branch-users.ts
 *
 * Las contraseñas se generan aleatorias y se imprimen al final — cámbialas o
 * pide a cada sucursal restablecerla ("¿Olvidaste tu contraseña?" en /login).
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ADMIN_EMAIL = "torrespierre437@gmail.com";

// Códigos reales sembrados en supabase/migrations/0003_seed.sql.
// Correos genéricos por código bajo el dominio pcponline.mx; edítalos aquí si alguna
// sucursal necesita un correo distinto.
const BRANCH_DOMAIN = "pcponline.mx";
const BRANCH_CODES = [
  "BJX", "CCA", "CEN", "CUL", "CSL", "ENS", "GDL", "GML", "GSV", "GYM",
  "HMO", "IZT", "LAP", "LMM", "MEX", "MXL", "MZT", "NJA", "NOG", "PBC",
  "QRO", "SLR", "TIJ", "TPQ", "ZAP",
];
const BRANCH_EMAILS: Record<string, string> = Object.fromEntries(
  BRANCH_CODES.map((code) => [code, `${code.toLowerCase()}@${BRANCH_DOMAIN}`])
);

function randomPassword() {
  return randomBytes(9).toString("base64").replace(/[/+=]/g, "x");
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno (.env.local)");
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const credentials: { email: string; password: string; role: string }[] = [];

  // Admin
  {
    const password = randomPassword();
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    await supabase.from("profiles").upsert({ id: data.user.id, role: "admin", email: ADMIN_EMAIL });
    credentials.push({ email: ADMIN_EMAIL, password, role: "admin" });
  }

  // Sucursales
  for (const [code, email] of Object.entries(BRANCH_EMAILS)) {
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id")
      .eq("code", code)
      .single();
    if (branchError || !branch) {
      console.warn(`Sucursal ${code} no encontrada en la tabla branches, se omite.`);
      continue;
    }

    const password = randomPassword();
    const { data: user, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      console.warn(`No se pudo crear ${code} (${email}): ${error.message}`);
      continue;
    }
    await supabase
      .from("profiles")
      .upsert({ id: user.user.id, role: "branch", branch_id: branch.id, email, full_name: code });
    credentials.push({ email, password, role: `branch:${code}` });
  }

  console.log("\nCuentas creadas (guarda esto, no se vuelve a mostrar la contraseña):\n");
  for (const c of credentials) {
    console.log(`${c.role.padEnd(12)} ${c.email.padEnd(30)} ${c.password}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
