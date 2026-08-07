"use client";

import { Download } from "lucide-react";
import { monthLabel } from "@/lib/dashboard";
import type { Category, EvaluationStatus } from "@/lib/supabase/types";

type BranchExportRow = {
  code: string;
  categoryScores: Record<string, number | null>;
  punctualityPct: number | null;
  finalScorePct: number | null;
  initialStatus: EvaluationStatus;
  followUpStatus: EvaluationStatus;
};

type Props = {
  month: number;
  year: number;
  categories: Category[];
  branchRows: BranchExportRow[];
};

const STATUS_LABEL: Record<EvaluationStatus, string> = {
  a_tiempo: "A tiempo",
  tardio: "Tardío",
  no_enviado: "No enviado",
  pendiente: "Pendiente",
};

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function ExportButton({ month, year, categories, branchRows }: Props) {
  function handleExport() {
    const header = [
      "Sucursal",
      ...categories.map((c) => c.name),
      "Puntualidad %",
      "Calificación final %",
      "Estado inicial",
      "Estado seguimiento",
    ];

    const rows = branchRows.map((r) => [
      r.code,
      ...categories.map((c) => {
        const v = r.categoryScores[c.id];
        return v === null || v === undefined ? "" : String(v);
      }),
      r.punctualityPct === null ? "" : String(r.punctualityPct),
      r.finalScorePct === null ? "" : String(r.finalScorePct),
      STATUS_LABEL[r.initialStatus],
      STATUS_LABEL[r.followUpStatus],
    ]);

    const csv = [header, ...rows].map((row) => row.map((cell) => csvCell(String(cell))).join(",")).join("\n");
    // BOM para que Excel detecte UTF-8 y no rompa los acentos/ñ.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluacion-sucursales-${monthLabel(month, year).replace(" ", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      Exportar CSV
    </button>
  );
}
