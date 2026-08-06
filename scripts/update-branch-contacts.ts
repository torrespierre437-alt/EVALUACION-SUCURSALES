/**
 * Actualiza el código de la sucursal CLN → CUL (corrección de captura del Excel
 * original) y reemplaza los correos placeholder (@pcponline.mx genéricos) por los
 * correos reales de cada encargado — tanto en `profiles.email` (solo informativo)
 * como en `auth.users.email` (el que realmente se usa para iniciar sesión).
 *
 * Uso: npx tsx scripts/update-branch-contacts.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const CONTACTS: Record<string, { name: string; email: string }> = {
  BJX: { name: "GERENCIA LEON GTO", email: "bjx_gerente@pcponline.mx" },
  CCA: { name: "MANUEL JAIME", email: "mjaime@pcponline.mx" },
  CEN: { name: "GERENCIA OBREGON", email: "cen_gerencia@pcponline.mx" },
  CUL: { name: "Jesus Manuel Rojo Iribe", email: "mrojo@pcponline.mx" },
  CSL: { name: "COORDINADOR CABO SAN LUCAS", email: "csl_coordinador@pcponline.mx" },
  ENS: { name: "GERENCIA ENSENADA", email: "ens_gerencia@pcponline.mx" },
  GDL: { name: "LUIS MARQUEZ", email: "lmarquez@pcponline.mx" },
  GML: { name: "Elvia Graciela Montoya Gastelum", email: "emontoya@pcponline.mx" },
  GSV: { name: "Pierre Carlo Ramon Torres Sevilla", email: "coordinador_gve@pcponline.mx" },
  GYM: { name: "GERENCIA GUAYMAS", email: "gym_gerente@pcponline.mx" },
  HMO: { name: "LOURDES FIGUEROA", email: "lfigueroa@pcponline.mx" },
  IZT: { name: "GERENCIA IZTAPALAPA", email: "izt_gerencia@pcponline.mx" },
  LAP: { name: "GERENTE LA PAZ", email: "lap_gerente@pcponline.mx" },
  LMM: { name: "Julian Payares Sañudo", email: "jpayares@pcponline.mx" },
  MEX: { name: "GERENTE SUCURSAL MEXICO", email: "mex_gerencia@pcponline.mx" },
  MXL: { name: "GERENCIA MEXICALI", email: "mxl_gerencia@pcponline.mx" },
  MZT: { name: "JESUS RAMIREZ", email: "jramirez@pcponline.mx" },
  NJA: { name: "GERENCIA NAVOJOA", email: "nja_gerencia@pcponline.mx" },
  NOG: { name: "GERENCIA NOGALES", email: "nog_gerencia@pcponline.mx" },
  PBC: { name: "GERENTE PUEBLA", email: "pbc_gerente@pcponline.mx" },
  QRO: { name: "IVAN EDUARDO RAMIREZ", email: "gerencia_qro@pcponline.mx" },
  SLR: { name: "INDALECIO", email: "slrc_gerencia@pcponline.mx" },
  TIJ: { name: "GERENTE TIJUANA", email: "tjn_gerencia@pcponline.mx" },
  TPQ: { name: "GERENCIA TEPIC", email: "tpq_gerente@pcponline.mx" },
  ZAP: { name: "ABRAHAM RUIZ", email: "zap_gerente@pcponline.mx" },
};

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // 1. Corregir el código CLN -> CUL (mismo branch, error de captura del Excel original).
  const { data: cln } = await supabase.from("branches").select("id, code").eq("code", "CLN").maybeSingle();
  if (cln) {
    const { error } = await supabase.from("branches").update({ code: "CUL" }).eq("id", cln.id);
    if (error) throw error;
    console.log("Renombrado CLN -> CUL");
  } else {
    console.log("CLN ya no existe (probablemente ya se corrigió antes).");
  }

  // 2. Actualizar correos reales por sucursal.
  for (const [code, contact] of Object.entries(CONTACTS)) {
    const { data: branch } = await supabase.from("branches").select("id").eq("code", code).maybeSingle();
    if (!branch) {
      console.warn(`Sucursal ${code} no encontrada, se omite.`);
      continue;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("branch_id", branch.id)
      .maybeSingle();
    if (!profile) {
      console.warn(`Perfil de ${code} no encontrado, se omite.`);
      continue;
    }

    const newEmail = contact.email.toLowerCase();

    const { error: authError } = await supabase.auth.admin.updateUserById(profile.id, {
      email: newEmail,
      email_confirm: true,
    });
    if (authError) {
      console.warn(`No se pudo actualizar el login de ${code} (${newEmail}): ${authError.message}`);
      continue;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ email: newEmail, full_name: contact.name })
      .eq("id", profile.id);
    if (profileError) throw profileError;

    console.log(`${code.padEnd(4)} -> ${newEmail}  (${contact.name})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
