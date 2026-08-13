"use client";

import { useState } from "react";
import { Archive, Trash2, Loader2 } from "lucide-react";

type Props = { month: number; year: number; monthLabel: string };

export function ArchivePanel({ month, year, monthLabel }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [releaseMsg, setReleaseMsg] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/admin/archive?month=${month}&year=${year}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `respaldo-${monthLabel.replace(" ", "-")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el respaldo. Intenta de nuevo.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleRelease() {
    const confirmed = window.confirm(
      `¿Ya guardaste el ZIP de ${monthLabel} en un lugar seguro?\n\n` +
        "Esta acción borra las fotos de ese mes de Supabase de forma PERMANENTE (las calificaciones, comentarios e historial NO se tocan). No hay forma de deshacerlo."
    );
    if (!confirmed) return;

    setReleasing(true);
    setReleaseMsg(null);
    try {
      const res = await fetch("/api/admin/archive/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error desconocido");
      setReleaseMsg(
        data.freed > 0 ? `Se liberaron ${data.freed} foto(s) de Storage.` : "No había fotos para liberar en este mes."
      );
    } catch (err) {
      console.error(err);
      setReleaseMsg("No se pudo liberar el espacio. Intenta de nuevo.");
    } finally {
      setReleasing(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Archive className="h-3.5 w-3.5" aria-hidden="true" />}
        {downloading ? "Generando respaldo..." : `Respaldar ${monthLabel} (ZIP)`}
      </button>

      <button
        onClick={handleRelease}
        disabled={releasing || !downloaded}
        title={!downloaded ? "Primero descarga el respaldo de este mes" : undefined}
        className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
      >
        {releasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
        {releasing ? "Liberando..." : "Liberar fotos ya respaldadas"}
      </button>

      {releaseMsg && <span className="text-xs text-slate-500">{releaseMsg}</span>}
    </div>
  );
}
