import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { buildEvaluationPdf } from "@/lib/pdf/build-evaluation-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** PDF de una evaluación individual: respuestas por categoría, fotos, comentarios, pendientes y firma. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "solo admin" }, { status: 403 });

  const url = new URL(request.url);
  const evaluationId = url.searchParams.get("evaluationId");
  if (!evaluationId) return NextResponse.json({ error: "evaluationId requerido" }, { status: 400 });

  const admin = createServiceRoleClient();
  const result = await buildEvaluationPdf(admin, evaluationId);
  if (!result) return NextResponse.json({ error: "evaluación no encontrada" }, { status: 404 });

  const { buffer, branch, evaluation } = result;
  const filename = `evaluacion-${branch.code}-${evaluation.period}-${evaluation.month}-${evaluation.year}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
