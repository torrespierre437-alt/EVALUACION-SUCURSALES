/**
 * Fórmulas de negocio, validadas contra los valores reales de
 * DASHBOARD EDIFICIOS.xlsx (hojas Hoja1 y Puntualidad).
 *
 * Ejemplo verificado (sucursal BJX):
 *   categorías -> LIMPIEZA 1.0, PINTURA 0.7, MOB 0.7, ILUMINACION 1.0,
 *                 PLOMERIA 0.75, EDIFICIO 0.6, LETREROS 1.0, SEGURIDAD 1.0,
 *                 LOGO 1.0, PERSONAL 1.0
 *   evaluationScore  = mean(categorías) = 0.875
 *   puntualidad mes  = mean(1.0, 1.0)   = 1.0
 *   calificación final = mean(0.88, 1.0) = 0.94   (usando el score de seguimiento del mes)
 */

export type Answer = { weight: number; value: 0 | 1 };

const LATE_PENALTY_PER_DAY = 0.03;
/** Cuánto pesa la puntualidad en la calificación final (el resto es el checklist). */
export const PUNCTUALITY_WEIGHT = 0.2;
const MX_TIME_ZONE = "America/Mexico_City";

/** Índice de día de calendario (días desde época) de una fecha, en huso horario de México. */
function mxDayIndex(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MX_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const d = Number(parts.find((p) => p.type === "day")!.value);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Índice de día de calendario de una fecha "pura" (medianoche UTC, sin hora real — ver due_date). */
function utcDayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

/** score de una categoría = sum(valor * peso) / sum(peso) */
export function categoryScore(answers: Answer[]): number | null {
  if (answers.length === 0) return null;
  const den = answers.reduce((s, a) => s + a.weight, 0);
  if (den === 0) return null;
  const num = answers.reduce((s, a) => s + a.value * a.weight, 0);
  return num / den;
}

/** score de la evaluación = promedio simple de los scores de categoría con datos */
export function evaluationScore(categoryScores: Array<number | null>): number | null {
  const valid = categoryScores.filter((s): s is number => s !== null);
  if (valid.length === 0) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

/** puntualidad de un envío: 1 - 3% por día de retraso, 0 si nunca se envía */
export function punctualityScore(daysLate: number | null, submitted: boolean): number {
  if (!submitted) return 0;
  const late = Math.max(0, daysLate ?? 0);
  return Math.max(0, 1 - LATE_PENALTY_PER_DAY * late);
}

/** puntualidad global del mes = promedio(inicial, seguimiento) */
export function monthlyPunctuality(initial: number | null, followUp: number | null): number | null {
  const parts = [initial, followUp].filter((v): v is number => v !== null);
  if (parts.length === 0) return null;
  return parts.reduce((s, v) => s + v, 0) / parts.length;
}

/**
 * Calificación final del mes = promedio ponderado del checklist (score de seguimiento)
 * y la puntualidad global. El checklist pesa 80% y la puntualidad 20%: la impuntualidad
 * baja el puntaje pero no lo hunde. Si falta uno de los dos, se usa el que haya.
 */
export function finalScore(followUpEvaluationScore: number | null, monthlyPunctualityScore: number | null): number | null {
  if (followUpEvaluationScore === null && monthlyPunctualityScore === null) return null;
  if (followUpEvaluationScore === null) return monthlyPunctualityScore;
  if (monthlyPunctualityScore === null) return followUpEvaluationScore;
  return followUpEvaluationScore * (1 - PUNCTUALITY_WEIGHT) + monthlyPunctualityScore * PUNCTUALITY_WEIGHT;
}

/**
 * Días de atraso comparando el DÍA de calendario en huso horario de México (no la
 * diferencia cruda en milisegundos): due_date se guarda como medianoche UTC del día
 * límite, así que comparar instantes directamente marcaba como "tardío" cualquier
 * envío hecho en horario de oficina de México el mismo día límite (México va 6h
 * detrás de UTC, así que ya eran más de 0ms de diferencia desde temprano en la mañana).
 */
export function daysLateBetween(dueDate: Date, submittedAt: Date | null): number {
  if (!submittedAt) return 0;
  return Math.max(0, mxDayIndex(submittedAt) - utcDayIndex(dueDate));
}
