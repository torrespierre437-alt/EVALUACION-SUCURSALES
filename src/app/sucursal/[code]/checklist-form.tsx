"use client";

import { useState, useTransition } from "react";
import { submitEvaluation } from "./actions";
import type { Category, ChecklistItem, Evaluation, EvaluationAnswer } from "@/lib/supabase/types";

type Props = {
  evaluation: Evaluation;
  branchCode: string;
  categories: Category[];
  items: ChecklistItem[];
  existingAnswers: EvaluationAnswer[];
};

export function ChecklistForm({ evaluation, branchCode, categories, items, existingAnswers }: Props) {
  const [answers, setAnswers] = useState<Record<string, { value: 0 | 1; comment?: string }>>(() => {
    const initial: Record<string, { value: 0 | 1; comment?: string }> = {};
    for (const a of existingAnswers) {
      initial[a.checklist_item_id] = { value: a.value, comment: a.comment ?? undefined };
    }
    return initial;
  });
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const itemsByCategory = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const list = itemsByCategory.get(item.category_id) ?? [];
    list.push(item);
    itemsByCategory.set(item.category_id, list);
  }

  const total = items.length;
  const answered = Object.keys(answers).length;

  function setValue(itemId: string, value: 0 | 1) {
    setAnswers((prev) => ({ ...prev, [itemId]: { ...prev[itemId], value } }));
  }

  function setComment(itemId: string, comment: string) {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: { value: prev[itemId]?.value ?? 1, comment },
    }));
  }

  function handleSubmit() {
    startTransition(async () => {
      await submitEvaluation(evaluation.id, branchCode, answers, items);
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Evaluación enviada correctamente. Gracias.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-slate-600">
          {answered} de {total} puntos respondidos
        </p>
        <p className="text-xs text-slate-400">
          Periodo: {evaluation.period === "inicial" ? "Inicial" : "Seguimiento"} · Vence {evaluation.due_date}
        </p>
      </div>

      {categories.map((cat) => {
        const catItems = itemsByCategory.get(cat.id) ?? [];
        if (catItems.length === 0) return null;
        return (
          <div key={cat.id} className="rounded-lg border border-slate-200 bg-white">
            <h3 className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-800">
              {cat.name}
            </h3>
            <ul className="divide-y divide-slate-100">
              {catItems.map((item) => (
                <li key={item.id} className="space-y-2 px-4 py-3">
                  <p className="text-sm text-slate-700">{item.description}</p>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name={`item-${item.id}`}
                        checked={answers[item.id]?.value === 1}
                        onChange={() => setValue(item.id, 1)}
                      />
                      Cumple
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name={`item-${item.id}`}
                        checked={answers[item.id]?.value === 0}
                        onChange={() => setValue(item.id, 0)}
                      />
                      No cumple
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Comentario (opcional)"
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                    defaultValue={answers[item.id]?.comment ?? ""}
                    onBlur={(e) => setComment(item.id, e.target.value)}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <button
        onClick={handleSubmit}
        disabled={isPending || answered < total}
        className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {isPending ? "Enviando..." : "Enviar evaluación"}
      </button>
    </div>
  );
}
