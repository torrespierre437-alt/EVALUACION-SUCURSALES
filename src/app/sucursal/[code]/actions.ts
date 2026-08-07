"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categoryScore, evaluationScore, punctualityScore, daysLateBetween } from "@/lib/scoring";
import type { ChecklistItem } from "@/lib/supabase/types";

/**
 * Autoguardado: guarda UNA respuesta al momento (sin cerrar la evaluación ni calcular
 * el score final), para que no se pierda avance si se corta la conexión o se cierra
 * la app antes de llegar al botón "Enviar evaluación".
 */
export async function saveAnswer(
  evaluationId: string,
  checklistItemId: string,
  answer: { value: 0 | 1; comment?: string; photo_url?: string }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("evaluation_answers").upsert(
    {
      evaluation_id: evaluationId,
      checklist_item_id: checklistItemId,
      value: answer.value,
      comment: answer.comment ?? null,
      photo_url: answer.photo_url ?? null,
    },
    { onConflict: "evaluation_id,checklist_item_id" }
  );
  if (error) throw error;
}

/** Guarda las respuestas del checklist, calcula el score y marca la evaluación como enviada. */
export async function submitEvaluation(
  evaluationId: string,
  branchCode: string,
  answers: Record<string, { value: 0 | 1; comment?: string; photo_url?: string }>,
  items: ChecklistItem[]
) {
  const supabase = await createClient();

  const { data: evaluation } = await supabase
    .from("evaluations")
    .select("id, due_date")
    .eq("id", evaluationId)
    .single();
  if (!evaluation) throw new Error("Evaluación no encontrada");

  const rows = Object.entries(answers).map(([checklist_item_id, a]) => ({
    evaluation_id: evaluationId,
    checklist_item_id,
    value: a.value,
    comment: a.comment ?? null,
    photo_url: a.photo_url ?? null,
  }));

  const { error: answersError } = await supabase
    .from("evaluation_answers")
    .upsert(rows, { onConflict: "evaluation_id,checklist_item_id" });
  if (answersError) throw answersError;

  const byCategory = new Map<string, { weight: number; value: 0 | 1 }[]>();
  for (const item of items) {
    const answer = answers[item.id];
    if (!answer) continue;
    const list = byCategory.get(item.category_id) ?? [];
    list.push({ weight: item.weight, value: answer.value });
    byCategory.set(item.category_id, list);
  }
  const catScores = Array.from(byCategory.values()).map(categoryScore);
  const score = evaluationScore(catScores);

  const now = new Date();
  const daysLate = daysLateBetween(new Date(evaluation.due_date), now);
  const punctuality = punctualityScore(daysLate, true);
  const status = daysLate > 0 ? "tardio" : "a_tiempo";

  const { error: updateError } = await supabase
    .from("evaluations")
    .update({
      submitted_at: now.toISOString(),
      days_late: daysLate,
      punctuality_score: punctuality,
      evaluation_score: score,
      status,
    })
    .eq("id", evaluationId);
  if (updateError) throw updateError;

  revalidatePath(`/sucursal/${branchCode}`);
}

export async function addFollowupNote(followupId: string, branchCode: string, note: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("followup_notes").insert({
    followup_id: followupId,
    note,
    created_by: user?.id ?? null,
  });
  if (error) throw error;

  revalidatePath(`/sucursal/${branchCode}`);
}

export async function resolveFollowup(followupId: string, branchCode: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("followups").update({ status: "resuelto" }).eq("id", followupId);
  if (error) throw error;
  revalidatePath(`/sucursal/${branchCode}`);
}

export async function createFollowup(
  branchCode: string,
  branchId: string,
  description: string,
  originEvaluationId?: string
) {
  const supabase = await createClient();
  const { error } = await supabase.from("followups").insert({
    branch_id: branchId,
    origin_evaluation_id: originEvaluationId ?? null,
    description,
    status: "pendiente",
  });
  if (error) throw error;
  revalidatePath(`/sucursal/${branchCode}`);
}
