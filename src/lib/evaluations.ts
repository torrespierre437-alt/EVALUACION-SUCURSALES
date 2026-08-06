import type { SupabaseClient } from "@supabase/supabase-js";
import type { Evaluation, EvaluationPeriod } from "@/lib/supabase/types";

/**
 * Fechas límite del mes en curso: día 1 = inicial, día 27 = seguimiento.
 * Se calculan en UTC para que coincidan con due_date/submitted_at guardados como
 * fecha UTC en el resto del código (ver src/app/api/cron/daily/route.ts).
 */
export function currentMonthPeriods(now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const inicialDue = new Date(Date.UTC(year, month - 1, 1));
  const seguimientoDue = new Date(Date.UTC(year, month - 1, 27));
  return { year, month, inicialDue, seguimientoDue };
}

/**
 * La evaluación no depende de que el cron ya haya corrido: si a la sucursal no le
 * toca ninguna "pendiente" todavía, se crea aquí mismo (con la fecha límite real del
 * periodo, aunque ya haya pasado) para que el formulario esté siempre disponible y
 * la puntualidad se siga calculando con la fecha de captura real.
 */
export async function ensureCurrentEvaluation(
  supabase: SupabaseClient,
  branchId: string,
  monthEvaluations: Evaluation[]
): Promise<Evaluation | null> {
  const now = new Date();
  const { year, month, inicialDue, seguimientoDue } = currentMonthPeriods(now);

  const inicial = monthEvaluations.find((e) => e.period === "inicial");
  const seguimiento = monthEvaluations.find((e) => e.period === "seguimiento");

  if (inicial?.status === "pendiente") return inicial;
  if (!inicial) return createEvaluation(supabase, branchId, "inicial", month, year, inicialDue);

  if (seguimiento?.status === "pendiente") return seguimiento;
  if (!seguimiento) return createEvaluation(supabase, branchId, "seguimiento", month, year, seguimientoDue);

  return null; // ambos periodos del mes ya se enviaron
}

async function createEvaluation(
  supabase: SupabaseClient,
  branchId: string,
  period: EvaluationPeriod,
  month: number,
  year: number,
  dueDate: Date
): Promise<Evaluation | null> {
  const { data, error } = await supabase
    .from("evaluations")
    .upsert(
      {
        branch_id: branchId,
        period,
        month,
        year,
        due_date: dueDate.toISOString().slice(0, 10),
        status: "pendiente",
      },
      { onConflict: "branch_id,period,month,year", ignoreDuplicates: false }
    )
    .select("*")
    .single();
  if (error) {
    console.error("No se pudo crear la evaluación:", error.message);
    return null;
  }
  return data as Evaluation;
}
