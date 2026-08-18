"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, X, Camera, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { saveAnswer, submitEvaluation } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";
import {
  pendingKey,
  savePending,
  removePending,
  listPendingForEvaluation,
  type PendingItem,
} from "@/lib/offline-queue";
import type { Category, ChecklistItem, Evaluation, EvaluationAnswer } from "@/lib/supabase/types";

type Answer = { value: 0 | 1; comment?: string; photo_url?: string };
type SaveState = "idle" | "saving" | "saved" | "pending";

const RETRY_INTERVAL_MS = 20000;

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
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const signaturePadRef = useRef<SignaturePadHandle | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Respuestas/fotos que no se pudieron sincronizar (sin señal) — quedan guardadas en
  // IndexedDB (ver src/lib/offline-queue.ts) y se reintentan solas al volver la conexión,
  // incluso si se cierra la pestaña antes de que se logre subir.
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
  const [localPreviewByItem, setLocalPreviewByItem] = useState<Record<string, string>>({});

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
  const categoriesWithItems = categories.filter((cat) => (itemsByCategory.get(cat.id) ?? []).length > 0);

  const total = items.length;
  const answered = Object.keys(answers).length;
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;

  function isCategoryComplete(catId: string) {
    const catItems = itemsByCategory.get(catId) ?? [];
    return catItems.length > 0 && catItems.every((item) => answers[item.id]?.value !== undefined);
  }

  // Secciones ya completas al cargar (de una sesión anterior) se dan por guardadas
  // solas, sin obligar a re-confirmar cada una.
  const initiallySavedIds = categoriesWithItems.filter((cat) => isCategoryComplete(cat.id)).map((cat) => cat.id);
  const [savedCategories, setSavedCategories] = useState<Set<string>>(() => new Set(initiallySavedIds));
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(() => {
    const initiallySaved = new Set(initiallySavedIds);
    const firstIncomplete = categoriesWithItems.find((cat) => !initiallySaved.has(cat.id));
    return (firstIncomplete ?? categoriesWithItems[0])?.id ?? null;
  });

  // Intenta sincronizar un item pendiente: sube la foto si trae una sin subir, y
  // guarda la respuesta. No lanza — regresa ok:false si algo falla (sin señal, etc.)
  // para que el que llama decida si reintentar después.
  async function trySyncItem(item: PendingItem): Promise<{ ok: true; photoUrl?: string } | { ok: false }> {
    try {
      let photoUrl = item.photoUrl;
      if (item.photoBlob) {
        const supabase = createClient();
        const path = `${branchId}/${item.evaluationId}/${item.itemId}-${Date.now()}.${item.photoExt ?? "jpg"}`;
        const { error } = await supabase.storage.from("evidence").upload(path, item.photoBlob, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from("evidence").getPublicUrl(path);
        photoUrl = data.publicUrl;
      }
      await saveAnswer(item.evaluationId, item.itemId, { value: item.value, comment: item.comment, photo_url: photoUrl });
      return { ok: true, photoUrl };
    } catch (err) {
      console.error("Error sincronizando respuesta:", err);
      return { ok: false };
    }
  }

  async function persist(itemId: string, answer: Answer, photoBlob?: Blob) {
    const version = (saveVersionRef.current[itemId] ?? 0) + 1;
    saveVersionRef.current[itemId] = version;

    const item: PendingItem = {
      key: pendingKey(evaluation.id, itemId),
      evaluationId: evaluation.id,
      itemId,
      value: answer.value,
      comment: answer.comment,
      photoUrl: photoBlob ? undefined : answer.photo_url,
      photoBlob,
      photoExt: "jpg",
      updatedAt: Date.now(),
    };
    // Se guarda en IndexedDB ANTES de intentar la red: así sobrevive aunque se
    // cierre la pestaña a medio subir con mala señal.
    await savePending(item).catch(() => {});
    setPendingItemIds((prev) => new Set(prev).add(itemId));
    setSaveStateByItem((prev) => ({ ...prev, [itemId]: "saving" }));

    const result = await trySyncItem(item);
    if (saveVersionRef.current[itemId] !== version) return; // llegó una respuesta más nueva

    if (result.ok) {
      await removePending(item.key).catch(() => {});
      setPendingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      setSaveStateByItem((prev) => ({ ...prev, [itemId]: "saved" }));
      if (result.photoUrl) {
        setAnswers((prev) => ({ ...prev, [itemId]: { ...prev[itemId], photo_url: result.photoUrl } }));
      }
    } else {
      setSaveStateByItem((prev) => ({ ...prev, [itemId]: "pending" }));
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
      const compressed = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressed);
      setLocalPreviewByItem((prev) => ({ ...prev, [itemId]: previewUrl }));
      setAnswers((prev) => {
        const next = { ...prev, [itemId]: { ...prev[itemId], value: prev[itemId]?.value ?? 1 } };
        persist(itemId, next[itemId], compressed);
        return next;
      });
    } catch (err) {
      console.error("Error preparando foto:", err);
      alert("No se pudo preparar la foto. Intenta de nuevo.");
    } finally {
      setUploadingItemId(null);
    }
  }

  // Reintenta todo lo pendiente de esta evaluación: se llama al montar (por si quedó
  // algo sin sincronizar de una sesión anterior), al volver la conexión, y cada
  // RETRY_INTERVAL_MS mientras haya algo pendiente.
  async function flushPending() {
    let queued: PendingItem[] = [];
    try {
      queued = await listPendingForEvaluation(evaluation.id);
    } catch {
      return;
    }
    if (queued.length === 0) return;

    setAnswers((prev) => {
      const next = { ...prev };
      for (const item of queued) {
        if (!next[item.itemId]) {
          next[item.itemId] = { value: item.value, comment: item.comment, photo_url: item.photoUrl };
        }
      }
      return next;
    });
    setPendingItemIds((prev) => {
      const next = new Set(prev);
      for (const item of queued) next.add(item.itemId);
      return next;
    });
    setSaveStateByItem((prev) => {
      const next = { ...prev };
      for (const item of queued) if (next[item.itemId] !== "saving") next[item.itemId] = "pending";
      return next;
    });

    for (const item of queued) {
      const version = (saveVersionRef.current[item.itemId] ?? 0) + 1;
      saveVersionRef.current[item.itemId] = version;
      setSaveStateByItem((prev) => ({ ...prev, [item.itemId]: "saving" }));
      const result = await trySyncItem(item);
      if (saveVersionRef.current[item.itemId] !== version) continue;
      if (result.ok) {
        await removePending(item.key).catch(() => {});
        setPendingItemIds((prev) => {
          const next = new Set(prev);
          next.delete(item.itemId);
          return next;
        });
        setSaveStateByItem((prev) => ({ ...prev, [item.itemId]: "saved" }));
        if (result.photoUrl) {
          setAnswers((prev) => ({ ...prev, [item.itemId]: { ...prev[item.itemId], photo_url: result.photoUrl } }));
        }
      } else {
        setSaveStateByItem((prev) => ({ ...prev, [item.itemId]: "pending" }));
      }
    }
  }

  useEffect(() => {
    flushPending();
    window.addEventListener("online", flushPending);
    const interval = setInterval(flushPending, RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", flushPending);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluation.id]);

  function handleSubmit() {
    startTransition(async () => {
      setSubmitError(null);
      if (pendingItemIds.size > 0) {
        setSubmitError(`Espera a que terminen de sincronizar ${pendingItemIds.size} punto(s) — se está reintentando solo.`);
        return;
      }
      try {
        const signatureFile = await signaturePadRef.current?.toPngFile("signature.png");
        if (!signatureFile) {
          setSubmitError("Falta firmar antes de enviar.");
          return;
        }
        const supabase = createClient();
        const path = `${branchId}/${evaluation.id}/signature.png`;
        const { error } = await supabase.storage.from("evidence").upload(path, signatureFile, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from("evidence").getPublicUrl(path);

        await submitEvaluation(evaluation.id, branchCode, answers, items, data.publicUrl);
        setDone(true);
      } catch (err) {
        console.error("Error enviando evaluación:", err);
        setSubmitError("No se pudo enviar la evaluación. Intenta de nuevo.");
      }
    });
  }

  // No hace ninguna llamada nueva: cada respuesta ya se autoguardó al contestarla.
  // "Guardar sección" solo confirma que la sección quedó completa y avanza a la
  // siguiente pestaña pendiente.
  function saveSection(catId: string) {
    setSavedCategories((prev) => new Set(prev).add(catId));
    const nextPending = categoriesWithItems.find((cat) => cat.id !== catId && !savedCategories.has(cat.id));
    setActiveCategoryId(nextPending?.id ?? catId);
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
          <p className="text-xs text-slate-500">
            {evaluation.period === "inicial" ? "Inicial" : "Seguimiento"} · Vence {evaluation.due_date}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">
          Tus respuestas se guardan solas conforme las vas contestando — puedes cerrar la app y seguir después.
        </p>
        {pendingItemIds.size > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {pendingItemIds.size} punto(s) sin señal — se sincronizan solos al recuperar conexión.
            </span>
            <button type="button" onClick={flushPending} className="shrink-0 font-medium underline">
              Reintentar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {categoriesWithItems.map((cat) => {
          const catItems = itemsByCategory.get(cat.id) ?? [];
          const catAnswered = catItems.filter((item) => answers[item.id]?.value !== undefined).length;
          const isSaved = savedCategories.has(cat.id);
          const isActive = activeCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryId(cat.id)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-center leading-tight transition-colors ${
                isActive
                  ? "border-brand bg-brand text-white"
                  : isSaved
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-1 text-[11px] font-semibold">
                {isSaved && <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />}
                <span className="truncate">{cat.name}</span>
              </span>
              <span className={`text-[10px] ${isActive ? "text-white/80" : "text-slate-400"}`}>
                {catAnswered}/{catItems.length}
              </span>
            </button>
          );
        })}
      </div>

      {categoriesWithItems.map((cat) => {
        if (cat.id !== activeCategoryId) return null;
        const catItems = itemsByCategory.get(cat.id) ?? [];
        const complete = isCategoryComplete(cat.id);
        const saved = savedCategories.has(cat.id);
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
                  <li key={item.id} className="space-y-2 px-4 py-3">
                    <p className="text-sm text-slate-700">{item.description}</p>

                    <div className="flex items-center gap-2">
                      <div className="flex h-9 flex-1 overflow-hidden rounded-md border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setValue(item.id, 1)}
                          className={`flex flex-1 items-center justify-center gap-1 text-xs font-medium transition-colors ${
                            answer?.value === 1
                              ? "bg-green-600 text-white"
                              : "bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Cumple
                        </button>
                        <button
                          type="button"
                          onClick={() => setValue(item.id, 0)}
                          className={`flex flex-1 items-center justify-center gap-1 border-l border-slate-200 text-xs font-medium transition-colors ${
                            answer?.value === 0
                              ? "bg-red-600 text-white"
                              : "bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                          No cumple
                        </button>
                      </div>

                      <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50">
                        {uploadingItemId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Camera className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span className="sr-only">Adjuntar foto</span>
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

                      {(answer?.photo_url || localPreviewByItem[item.id]) && (
                        <a
                          href={answer?.photo_url ?? localPreviewByItem[item.id]}
                          target="_blank"
                          rel="noreferrer"
                          className="relative shrink-0"
                        >
                          <img
                            src={answer?.photo_url ?? localPreviewByItem[item.id]}
                            alt="Evidencia"
                            className="h-9 w-9 rounded object-cover"
                          />
                          {!answer?.photo_url && (
                            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500">
                              <RefreshCw className="h-2 w-2 text-white" aria-hidden="true" />
                            </span>
                          )}
                        </a>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Comentario (opcional)"
                      className="h-8 w-full rounded-md border border-slate-200 px-2.5 text-xs"
                      defaultValue={answer?.comment ?? ""}
                      onBlur={(e) => setComment(item.id, e.target.value)}
                    />

                    <p className="h-3.5 text-[11px] leading-none">
                      {saveState === "saving" && <span className="text-slate-500">Guardando…</span>}
                      {saveState === "saved" && (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Guardado
                        </span>
                      )}
                      {saveState === "pending" && (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <RefreshCw className="h-3 w-3" aria-hidden="true" />
                          Sin señal, se sincroniza solo
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-slate-100 px-4 py-2.5">
              <button
                type="button"
                onClick={() => saveSection(cat.id)}
                disabled={!complete}
                className={`h-10 w-full rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-40 ${
                  saved
                    ? "border border-green-200 bg-green-50 text-green-700"
                    : "bg-brand text-white hover:bg-brand-dark"
                }`}
              >
                {saved ? (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Sección guardada
                  </span>
                ) : complete ? (
                  "Guardar sección"
                ) : (
                  `Faltan ${catItems.length - catItems.filter((item) => answers[item.id]?.value !== undefined).length} puntos de esta área`
                )}
              </button>
            </div>
          </div>
        );
      })}

      {savedCategories.size >= categoriesWithItems.length && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <SignaturePad ref={signaturePadRef} onChange={setHasSignature} />
        </div>
      )}

      {submitError && <p className="text-center text-xs text-red-600">{submitError}</p>}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white p-3 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <button
          onClick={handleSubmit}
          disabled={
            isPending || savedCategories.size < categoriesWithItems.length || !hasSignature || pendingItemIds.size > 0
          }
          className="mx-auto block h-11 w-full max-w-2xl rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
        >
          {isPending
            ? "Enviando..."
            : savedCategories.size < categoriesWithItems.length
              ? `Faltan ${categoriesWithItems.length - savedCategories.size} secciones por guardar`
              : pendingItemIds.size > 0
                ? `Sincronizando ${pendingItemIds.size} punto(s)...`
                : !hasSignature
                  ? "Falta firmar"
                  : "Enviar evaluación"}
        </button>
      </div>
    </div>
  );
}
