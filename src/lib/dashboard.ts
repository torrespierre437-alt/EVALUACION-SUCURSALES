import { categoryScore, monthlyPunctuality, finalScore } from "@/lib/scoring";
import type { Branch, Category, ChecklistItem, Evaluation, EvaluationAnswer } from "@/lib/supabase/types";

export type BranchRow = {
  branch: Branch;
  initial: Evaluation | null;
  followUp: Evaluation | null;
  monthlyPunctualityPct: number | null;
  finalScorePct: number | null;
};

/** Combina las evaluaciones inicial/seguimiento del mes en curso por sucursal. */
export function buildBranchRows(branches: Branch[], evaluations: Evaluation[], month: number, year: number): BranchRow[] {
  return branches.map((branch) => {
    const monthEvals = evaluations.filter((e) => e.branch_id === branch.id && e.month === month && e.year === year);
    const initial = monthEvals.find((e) => e.period === "inicial") ?? null;
    const followUp = monthEvals.find((e) => e.period === "seguimiento") ?? null;

    const punctuality = monthlyPunctuality(initial?.punctuality_score ?? null, followUp?.punctuality_score ?? null);
    const scoreForFinal = followUp?.evaluation_score ?? initial?.evaluation_score ?? null;
    const final = finalScore(scoreForFinal, punctuality);

    return {
      branch,
      initial,
      followUp,
      monthlyPunctualityPct: punctuality !== null ? Math.round(punctuality * 100) : null,
      finalScorePct: final !== null ? Math.round(final * 100) : null,
    };
  });
}

export type CategoryMatrixRow = {
  branchCode: string;
  scoresByCategory: Record<string, number | null>; // categoryId -> % 0-100
};

/** Matriz sucursal x categoría a partir de las respuestas de la evaluación vigente de cada sucursal. */
export function buildCategoryMatrix(
  branchEvaluationIds: { branchCode: string; evaluationId: string | null }[],
  answersByEvaluationId: Record<string, EvaluationAnswer[]>,
  items: ChecklistItem[]
): CategoryMatrixRow[] {
  const itemById = new Map(items.map((i) => [i.id, i]));

  return branchEvaluationIds.map(({ branchCode, evaluationId }) => {
    const answers = evaluationId ? answersByEvaluationId[evaluationId] ?? [] : [];
    const byCategory = new Map<string, { weight: number; value: 0 | 1 }[]>();
    for (const a of answers) {
      const item = itemById.get(a.checklist_item_id);
      if (!item) continue;
      const list = byCategory.get(item.category_id) ?? [];
      list.push({ weight: item.weight, value: a.value });
      byCategory.set(item.category_id, list);
    }
    const scoresByCategory: Record<string, number | null> = {};
    for (const [catId, list] of byCategory.entries()) {
      const s = categoryScore(list);
      scoresByCategory[catId] = s !== null ? Math.round(s * 100) : null;
    }
    return { branchCode, scoresByCategory };
  });
}

export function monthLabel(month: number, year: number) {
  const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${MONTHS[month - 1]} ${String(year).slice(2)}`;
}

/** Promedio nacional de cumplimiento/puntualidad por mes, para la gráfica histórica. */
export function buildNationalTrend(evaluations: Evaluation[]) {
  const byMonth = new Map<string, { month: number; year: number; scores: number[]; punct: number[] }>();
  for (const e of evaluations) {
    const key = `${e.year}-${e.month}`;
    const bucket = byMonth.get(key) ?? { month: e.month, year: e.year, scores: [], punct: [] };
    if (e.evaluation_score !== null) bucket.scores.push(e.evaluation_score);
    if (e.punctuality_score !== null) bucket.punct.push(e.punctuality_score);
    byMonth.set(key, bucket);
  }
  return Array.from(byMonth.values())
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((b) => ({
      label: monthLabel(b.month, b.year),
      promedio: b.scores.length ? Math.round((b.scores.reduce((s, v) => s + v, 0) / b.scores.length) * 100) : 0,
      puntualidad: b.punct.length ? Math.round((b.punct.reduce((s, v) => s + v, 0) / b.punct.length) * 100) : 0,
    }));
}
