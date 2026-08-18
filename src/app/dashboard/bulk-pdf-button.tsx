"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import type { EvaluationPeriod } from "@/lib/supabase/types";

type Props = { month: number; year: number; monthLabel: string };

const PERIOD_LABEL: Record<EvaluationPeriod, string> = { inicial: "Inicial", seguimiento: "Seguimiento" };

export function BulkPdfButton({ month, year, monthLabel }: Props) {
  const [downloading, setDownloading] = useState<EvaluationPeriod | null>(null);

  async function handleDownload(period: EvaluationPeriod) {
    setDownloading(period);
    try {
      const res = await fetch(`/api/admin/evaluation-pdf/bulk?month=${month}&year=${year}&period=${period}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evaluaciones-${period}-${monthLabel.replace(" ", "-")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("No se pudieron generar los PDFs. Intenta de nuevo.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {(["inicial", "seguimiento"] as const).map((period) => (
        <button
          key={period}
          onClick={() => handleDownload(period)}
          disabled={downloading !== null}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {downloading === period ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {downloading === period ? "Generando..." : `${PERIOD_LABEL[period]} (PDF ZIP)`}
        </button>
      ))}
    </div>
  );
}
