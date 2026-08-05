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

/** calificación final del mes = promedio(score de seguimiento, puntualidad global) */
export function finalScore(followUpEvaluationScore: number | null, monthlyPunctualityScore: number | null): number | null {
  const parts = [followUpEvaluationScore, monthlyPunctualityScore].filter((v): v is number => v !== null);
  if (parts.length === 0) return null;
  return parts.reduce((s, v) => s + v, 0) / parts.length;
}

export function daysLateBetween(dueDate: Date, submittedAt: Date | null): number {
  if (!submittedAt) return 0;
  const ms = submittedAt.getTime() - dueDate.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}
