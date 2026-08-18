import Link from "next/link";
import type { MonthComparisonRow } from "@/lib/dashboard";

function deltaColor(delta: number | null) {
  if (delta === null) return "text-slate-400";
  if (delta > 0) return "text-green-700";
  if (delta < 0) return "text-red-700";
  return "text-slate-500";
}

function deltaLabel(delta: number | null) {
  if (delta === null) return "—";
  if (delta === 0) return "Sin cambio";
  const arrow = delta > 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(delta)} pts`;
}

export function ComparisonTable({ rows, previousLabel }: { rows: MonthComparisonRow[]; previousLabel: string }) {
  // Sucursales que más cayeron primero: es lo más accionable para seguimiento.
  const sorted = [...rows].sort((a, b) => (a.deltaPct ?? 0) - (b.deltaPct ?? 0));

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <th className="px-3 py-2 font-medium">Sucursal</th>
            <th className="px-3 py-2 font-medium">{previousLabel}</th>
            <th className="px-3 py-2 font-medium">Mes actual</th>
            <th className="px-3 py-2 font-medium">Variación</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.branchCode} className="border-b border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-700">
                <Link href={`/dashboard/${row.branchCode}`} className="underline hover:text-slate-900">
                  {row.branchCode}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-600">{row.previousPct !== null ? `${row.previousPct}%` : "—"}</td>
              <td className="px-3 py-2 font-semibold text-slate-800">
                {row.currentPct !== null ? `${row.currentPct}%` : "—"}
              </td>
              <td className={`px-3 py-2 font-medium ${deltaColor(row.deltaPct)}`}>{deltaLabel(row.deltaPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
