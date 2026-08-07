"use client";

import { useRef, useState, useTransition } from "react";
import { saveAnswer, submitEvaluation } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import type { Category, ChecklistItem, Evaluation, EvaluationAnswer } from "@/lib/supabase/types";

type Answer = { value: 0 | 1; comment?: string; photo_url?: string };
type SaveState = "idle" | "saving" | "saved" | "error";
type PhotoStage = "compressing" | "uploading";

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
  const [saveStateByItem, setSaveStateByItem] = useState<Record<string, SaveState>>(() => {
    const initial: Record<string, SaveState> = {};
    for (const a of existingAnswers) initial[a.checklist_item_id] = "saved";
    return initial;
  });
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [photoStage, setPhotoStage] = useState<PhotoStage>("compressing");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  // Autoguardado: cada respuesta se manda a la base al momento, no solo hasta el
  // final. Se guarda una "versión" por item para descartar respuestas de guardados
  // viejos que lleguen tarde (ej. si el usuario cambia de opinión varias veces rápido).
  const saveVersionRef = useRef<Record<string, number>>({});

  const itemsByCategory = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const list = itemsByCategory.get(item.category_id) ?? [];
    list.push(item);
    itemsByCategory.set(item.category_id, list);
  }

  const total = items.length;
  const answered = Object.keys(answers).length;
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;

  async function persist(itemId: string, answer: Answer) {
    const version = (saveVersionRef.current[itemId] ?? 0) + 1;
    saveVersionRef.current[itemId] = version;
    setSaveStateByItem((prev) => ({ ...prev, [itemId]: "saving" }));
    try {
      await saveAnswer(evaluation.id, itemId, answer);
      if (saveVersionRef.current[itemId] !== version) return; // llegó una respuesta más nueva
      setSaveStateByItem((prev) => ({ ...prev, [itemId]: "saved" }));
    } catch (err) {
      console.error("Error autoguardando respuesta:", err);
      if (saveVersionRef.current[itemId] !== version) return;
      setSaveStateByItem((prev) => ({ ...prev, [itemId]: "error" }));
    }
  }

  function setValue(itemId: string, value: 0 | 1) {
    setAnswers((prev) => {
      const next = { ...prev, [itemId]: { ...prev[itemId], value } };
      persist(itemId, next[itemId]);
      return next;
    });
  }

  function setComment(itemId: string, comment: string) {
    setAnswers((prev) => {
      const next = { ...prev, [itemId]: { ...prev[itemId], value: prev[itemId]?.value ?? 1, comment } };
      persist(itemId, next[itemId]);
      return next;
    });
  }

  async function handlePhoto(itemId: string, file: File) {
    setUploadingItemId(itemId);
    try {
      setPhotoStage("compressing");
      const compressed = await compressImage(file);
      setPhotoStage("uploading");

      const supabase = createClient();
      const ext = compressed.name.split(".").pop() || "jpg";
      const path = `${branchId}/${evaluation.id}/${itemId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("evidence").upload(path, compressed, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("evidence").getPublicUrl(path);
      setAnswers((prev) => {
        const next = { ...prev, [itemId]: { ...prev[itemId], value: prev[itemId]?.value ?? 1, photo_url: data.publicUrl } };
        persist(itemId, next[itemId]);
        return next;
      });
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
    <div className="space-y-6 pb-20">
      <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:bg-white">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            {answered} de {total} puntos respondidos
          </p>
          <p className="text-xs text-slate-400">
            {evaluation.period === "inicial" ? "Inicial" : "Seguimiento"} · Vence {evaluation.due_date}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">
          Tus respuestas se guardan solas conforme las vas contestando — puedes cerrar la app y seguir después.
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
              {catItems.map((item) => {
                const answer = answers[item.id];
                const saveState = saveStateByItem[item.id] ?? "idle";
                return (
                  <li key={item.id} className="space-y-3 px-4 py-4">
                    <p className="text-sm text-slate-700">{item.description}</p>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setValue(item.id, 1)}
                        className={`min-h-11 rounded-md border px-3 text-sm font-medium transition-colors ${
                          answer?.value === 1
                            ? "border-green-600 bg-green-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        ✓ Cumple
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue(item.id, 0)}
                        className={`min-h-11 rounded-md border px-3 text-sm font-medium transition-colors ${
                          answer?.value === 0
                            ? "border-red-600 bg-red-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        ✕ No cumple
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Comentario (opcional)"
                      className="min-h-11 w-full rounded-md border border-slate-200 px-3 text-sm"
                      defaultValue={answer?.comment ?? ""}
                      onBlur={(e) => setComment(item.id, e.target.value)}
                    />

                    <div className="flex items-center gap-3">
                      <label className="flex min-h-11 cursor-pointer items-center rounded-md border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50">
                        {uploadingItemId === item.id
                          ? photoStage === "compressing"
                            ? "Preparando foto..."
                            : "Subiendo..."
                          : "📷 Adjuntar foto"}
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
                      {answer?.photo_url && (
                        <a href={answer.photo_url} target="_blank" rel="noreferrer">
                          <img
                            src={answer.photo_url}
                            alt="Evidencia"
                            className="h-11 w-11 rounded object-cover"
                          />
                        </a>
                      )}
                    </div>

                    <p className="h-4 text-xs">
                      {saveState === "saving" && <span className="text-slate-400">Guardando…</span>}
                      {saveState === "saved" && <span className="text-green-600">✓ Guardado</span>}
                      {saveState === "error" && <span className="text-red-600">No se pudo guardar, revisa tu conexión</span>}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white p-3 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <button
          onClick={handleSubmit}
          disabled={isPending || answered < total}
          className="mx-auto block min-h-12 w-full max-w-2xl rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
        >
          {isPending ? "Enviando..." : answered < total ? `Faltan ${total - answered} puntos` : "Enviar evaluación"}
        </button>
      </div>
    </div>
  );
}
