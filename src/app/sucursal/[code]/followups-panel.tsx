"use client";

import { useState, useTransition } from "react";
import { addFollowupNote, resolveFollowup, createFollowup } from "./actions";
import type { Followup } from "@/lib/supabase/types";

export function FollowupsPanel({
  branchCode,
  branchId,
  followups,
}: {
  branchCode: string;
  branchId: string;
  followups: Followup[];
}) {
  const [isPending, startTransition] = useTransition();
  const [newDescription, setNewDescription] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  function submitNote(followupId: string) {
    const note = noteDrafts[followupId]?.trim();
    if (!note) return;
    startTransition(async () => {
      await addFollowupNote(followupId, branchCode, note);
      setNoteDrafts((prev) => ({ ...prev, [followupId]: "" }));
    });
  }

  function markResolved(followupId: string) {
    startTransition(async () => {
      await resolveFollowup(followupId, branchCode);
    });
  }

  function addPendiente() {
    const description = newDescription.trim();
    if (!description) return;
    startTransition(async () => {
      await createFollowup(branchCode, branchId, description);
      setNewDescription("");
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">Pendientes / seguimiento</h3>

      {followups.length === 0 && <p className="text-sm text-slate-400">Sin pendientes abiertos.</p>}

      <ul className="space-y-3">
        {followups.map((f) => (
          <li key={f.id} className="rounded-md border border-slate-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-slate-700">{f.description}</p>
              <button
                onClick={() => markResolved(f.id)}
                disabled={isPending}
                className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Marcar resuelto
              </button>
            </div>
            {f.last_note_at && (
              <p className="mt-1 text-xs text-slate-400">
                Último seguimiento: {new Date(f.last_note_at).toLocaleDateString("es-MX")} — {f.last_note}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Agregar nota de seguimiento..."
                className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
                value={noteDrafts[f.id] ?? ""}
                onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
              />
              <button
                onClick={() => submitNote(f.id)}
                disabled={isPending}
                className="rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200"
              >
                Guardar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <input
          type="text"
          placeholder="Nuevo pendiente..."
          className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
        />
        <button
          onClick={addPendiente}
          disabled={isPending}
          className="rounded-md bg-slate-900 px-3 py-1 text-sm text-white"
        >
          Agregar
        </button>
      </div>
    </div>
  );
}
