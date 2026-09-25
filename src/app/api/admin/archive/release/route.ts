import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Evaluation, EvaluationAnswer } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * Borra de Supabase Storage las fotos de evidencia de un mes ya respaldado
 * (ver /api/admin/archive) y limpia evaluation_answers.photo_urls — nunca toca
 * evaluations ni el resto de evaluation_answers, así que el dashboard, el
 * historial y las calificaciones siguen intactos; solo desaparecen las fotos.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "solo admin" }, { status: 403 });

  const { month, year } = await request.json();
  if (!month || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: "month/year inválidos" }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const { data: evaluations } = await admin
    .from("evaluations")
    .select("id")
    .eq("month", month)
    .eq("year", year);
  const evalIds = ((evaluations as Evaluation[]) ?? []).map((e) => e.id);
  if (evalIds.length === 0) {
    return NextResponse.json({ ok: true, freed: 0 });
  }

  const { data: answers } = await admin
    .from("evaluation_answers")
    .select("id, photo_urls")
    .in("evaluation_id", evalIds);
  const withPhotos = ((answers as Pick<EvaluationAnswer, "id" | "photo_urls">[]) ?? []).filter(
    (a) => (a.photo_urls ?? []).length > 0
  );

  if (withPhotos.length === 0) {
    return NextResponse.json({ ok: true, freed: 0 });
  }

  // De la URL pública .../storage/v1/object/public/evidence/<path> extraemos <path>.
  const marker = "/object/public/evidence/";
  const paths = withPhotos
    .flatMap((a) => a.photo_urls ?? [])
    .map((url) => {
      const idx = url.indexOf(marker);
      return idx >= 0 ? url.slice(idx + marker.length) : null;
    })
    .filter((p): p is string => !!p);

  const { error: removeError } = await admin.storage.from("evidence").remove(paths);
  if (removeError) {
    return NextResponse.json({ error: removeError.message }, { status: 500 });
  }

  const ids = withPhotos.map((a) => a.id);
  const { error: updateError } = await admin.from("evaluation_answers").update({ photo_urls: [] }).in("id", ids);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, freed: paths.length });
}
