import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { buildEvaluationPdf } from "@/lib/pdf/build-evaluation-pdf";
import { monthLabel } from "@/lib/dashboard";
import type { Branch, Evaluation, EvaluationPeriod } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * ZIP con el PDF de cada evaluación YA ENVIADA de un periodo (inicial o seguimiento)
 * en un mes. Se pide un periodo a la vez — no ambos juntos — porque en el plan
 * gratuito de Vercel las funciones se cortan a los 60s sin excepción, y con las 25
 * sucursales completas (2 periodos) el lote se acercaba demasiado a ese límite.
 * Se generan los PDFs en lotes pequeños en paralelo en vez de uno por uno.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "solo admin" }, { status: 403 });

  const url = new URL(request.url);
  const month = Number(url.searchParams.get("month"));
  const year = Number(url.searchParams.get("year"));
  const period = url.searchParams.get("period") as EvaluationPeriod | null;
  if (!month || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: "month/year inválidos" }, { status: 400 });
  }
  if (period !== "inicial" && period !== "seguimiento") {
    return NextResponse.json({ error: "period debe ser 'inicial' o 'seguimiento'" }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const [{ data: branches }, { data: evaluations }] = await Promise.all([
    admin.from("branches").select("*").order("code"),
    admin
      .from("evaluations")
      .select("*")
      .eq("month", month)
      .eq("year", year)
      .eq("period", period)
      .not("submitted_at", "is", null),
  ]);

  const branchById = new Map(((branches as Branch[]) ?? []).map((b) => [b.id, b]));
  const allEvaluations = (evaluations as Evaluation[]) ?? [];

  const zip = new JSZip();
  const CONCURRENCY = 6;
  let generated = 0;
  for (let i = 0; i < allEvaluations.length; i += CONCURRENCY) {
    const batch = allEvaluations.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (ev) => {
        try {
          const result = await buildEvaluationPdf(admin, ev.id);
          if (!result) return;
          const branch = branchById.get(ev.branch_id);
          const code = branch?.code ?? ev.branch_id;
          zip.file(`evaluacion-${code}-${ev.period}-${ev.month}-${ev.year}.pdf`, result.buffer);
          generated++;
        } catch {
          // si una evaluación falla, el ZIP se genera con el resto en vez de tronar completo
        }
      })
    );
  }

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  const label = monthLabel(month, year).replace(" ", "-");

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="evaluaciones-${period}-${label}.zip"`,
      "X-Generated-Count": String(generated),
    },
  });
}
