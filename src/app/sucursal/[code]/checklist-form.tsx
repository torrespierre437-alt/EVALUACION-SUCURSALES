"use client";

import { useState, useTransition } from "react";
import { submitEvaluation } from "./actions";
import { createClient } from "@/lib/supabase/client";
import type { Category, ChecklistItem, Evaluation, EvaluationAnswer } from "@/lib/supabase/types";

type Answer = { value: 0 | 1; comment?: string; photo_url?: string };

type Props = {
  evaluation: Evaluation;
  branchId: string;
  branchCode: string;
  categories: Category[];
  items: ChecklistItem[];
  existingAnswers: EvaluationAnswer[];
};

export function ChecklistForm({ evaluation, branchId, branchCode, categories, items, existingAnswers }: Props) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => {
    const initial: Record<string, Answer> = {};
    for (const a of existingAnswers) {
      initial[a.checklist_item_id] = {
        value: a.value,
        comment: a.comment ?? undefined,
        photo_url: a.photo_url ?? undefined,
      };
    }
    return initial;
  });
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
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
      [itemId]: { ...prev[itemId], value: prev[itemId]?.value ?? 1, comment },
    }));
  }

  async function handlePhoto(itemId: string, file: File) {
    setUploadingItemId(itemId);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${branchId}/${evaluation.id}/${itemId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("evidence").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("evidence").getPublicUrl(path);
      setAnswers((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], value: prev[itemId]?.value ?? 1, photo_url: data.publicUrl },
      }));
    } catch (err) {
      console.error("Error subiendo foto:", err);
      alert("No se pudo subir la foto. Intenta de nuevo.");
    } finally {
      setUploadingItemId(null);
    }
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
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                      {uploadingItemId === item.id ? "Subiendo..." : "📷 Adjuntar foto"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploadingItemId === item.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhoto(item.id, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {answers[item.id]?.photo_url && (
                      <a href={answers[item.id]?.photo_url} target="_blank" rel="noreferrer">
                        <img
                          src={answers[item.id]?.photo_url}
                          alt="Evidencia"
                          className="h-10 w-10 rounded object-cover"
                        />
                      </a>
                    )}
                  </div>
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
