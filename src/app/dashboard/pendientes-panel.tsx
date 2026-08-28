"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addFollowupNoteAdmin, resolveFollowupAdmin } from "./pendientes-actions";
import { formatInstantDateMx } from "@/lib/format-date";
import type { Followup } from "@/lib/supabase/types";

export type PendienteRow = Followup & { branchCode: string };

export function PendientesPanel({ followups }: { followups: PendienteRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  // El servidor sigue mandando el pendiente hasta el próximo revalidate; lo ocultamos
  // localmente en cuanto se marca resuelto para que la lista se sienta inmediata.
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  function submitNote(followupId: string) {
    const note = noteDrafts[followupId]?.trim();
    if (!note) return;
    startTransition(async () => {
      await addFollowupNoteAdmin(followupId, note);
      setNoteDrafts((prev) => ({ ...prev, [followupId]: "" }));
    });
  }

  function markResolved(followupId: string) {
    startTransition(async () => {
      await resolveFollowupAdmin(followupId);
      setResolvedIds((prev) => new Set(prev).add(followupId));
    });
  }

  const visible = followups.filter((f) => !resolvedIds.has(f.id));

  if (visible.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        No hay pendientes abiertos en ninguna sucursal.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <th className="px-3 py-2 font-medium">Sucursal</th>
            <th className="px-3 py-2 font-medium">Pendiente</th>
            <th className="px-3 py-2 font-medium">Último seguimiento</th>
            <th className="px-3 py-2 font-medium">Agregar seguimiento</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((f) => (
            <tr key={f.id} className="border-b border-slate-100 align-top">
              <td className="px-3 py-2 font-medium text-slate-700">
                <Link href={`/dashboard/${f.branchCode}`} className="underline hover:text-slate-900">
                  {f.branchCode}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-700">{f.description}</td>
              <td className="px-3 py-2 text-slate-500">
                {f.last_note_at ? (
                  <>
                    {formatInstantDateMx(f.last_note_at)} — {f.last_note}
                  </>
                ) : (
                  "Sin seguimiento todavía"
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={noteDrafts[f.id] ?? ""}
                    onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitNote(f.id);
                    }}
                    placeholder="Nueva nota..."
                    className="w-40 rounded-md border border-slate-200 px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => submitNote(f.id)}
                    disabled={isPending || !(noteDrafts[f.id] ?? "").trim()}
                    className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              </td>
              <td className="px-3 py-2">
                <button
                  onClick={() => markResolved(f.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Marcar resuelto
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
