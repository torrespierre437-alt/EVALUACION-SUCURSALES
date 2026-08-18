import type { SupabaseClient } from "@supabase/supabase-js";
import type { Evaluation, EvaluationPeriod } from "@/lib/supabase/types";

function isSunday(d: Date) {
  return d.getUTCDay() === 0;
}

/** Si el día cae domingo, lo recorre al siguiente (lunes) — solo domingo cuenta como no hábil. */
export function effectiveDueDate(year: number, month: number, day: number): Date {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (isSunday(d)) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Resta n días hábiles (saltando domingos) a partir de una fecha ya calculada. */
export function subtractBusinessDays(date: Date, n: number): Date {
  const d = new Date(date);
  let remaining = n;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (!isSunday(d)) remaining--;
  }
  return d;
}

/**
 * Fechas límite del mes: inicial vence el día 1, seguimiento el día 25 (recorridos
 * al siguiente día hábil si caen domingo). El checklist se abre 2 días hábiles antes
 * de cada vencimiento para dar tiempo a enviar a tiempo.
 * Se calculan en UTC para que coincidan con due_date/submitted_at guardados como
 * fecha UTC en el resto del código (ver src/app/api/cron/daily/route.ts).
 */
export function periodDates(year: number, month: number) {
  const inicialDue = effectiveDueDate(year, month, 1);
  const seguimientoDue = effectiveDueDate(year, month, 25);
  return {
    inicialDue,
    inicialOpen: subtractBusinessDays(inicialDue, 2),
    seguimientoDue,
    seguimientoOpen: subtractBusinessDays(seguimientoDue, 2),
  };
}

export function currentMonthPeriods(now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return { year, month, ...periodDates(year, month) };
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
  const { year, month, inicialDue, seguimientoDue, seguimientoOpen } = currentMonthPeriods(now);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const inicial = monthEvaluations.find((e) => e.period === "inicial");
  const seguimiento = monthEvaluations.find((e) => e.period === "seguimiento");

  // El periodo "seguimiento" no se ofrece antes de que abra (2 días hábiles antes de
  // su vencimiento), aunque "inicial" ya se haya enviado — antes se creaba de inmediato
  // al terminar "inicial", lo cual rompía el dashboard (tomaba esa evaluación vacía en
  // vez de la ya llenada).
  if (today < seguimientoOpen) {
    if (inicial?.status === "pendiente") return inicial;
    if (!inicial) return createEvaluation(supabase, branchId, "inicial", month, year, inicialDue);
    return null;
  }

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
