import Link from "next/link";
import { StatusBadge } from "./status-badge";
import type { BranchRow } from "@/lib/dashboard";

function scoreColor(pct: number | null) {
  if (pct === null) return "text-slate-400";
  if (pct >= 90) return "text-green-700";
  if (pct >= 75) return "text-amber-700";
  return "text-red-700";
}

const fmt = (pct: number | null) => (pct === null ? "—" : `${pct}%`);

export function ScoreBreakdown({ rows }: { rows: BranchRow[] }) {
  const sorted = [...rows].sort((a, b) => (b.finalScorePct ?? -1) - (a.finalScorePct ?? -1));

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <th className="px-3 py-2 font-medium">Sucursal</th>
            <th className="px-3 py-2 font-medium">Envío inicial</th>
            <th className="px-3 py-2 font-medium">Envío seguim.</th>
            <th className="px-3 py-2 font-medium">Calif. inicial</th>
            <th className="px-3 py-2 font-medium">Calif. seguim.</th>
            <th className="px-3 py-2 font-medium">Puntualidad</th>
            <th className="px-3 py-2 font-medium">Final</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.branch.id} className="border-b border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-700">
                <Link href={`/dashboard/${r.branch.code}`} className="underline hover:text-slate-900">
                  {r.branch.code}
                </Link>
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={r.initial?.status ?? "pendiente"} />
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={r.followUp?.status ?? "pendiente"} />
              </td>
              <td className={`px-3 py-2 ${scoreColor(r.initialScorePct)}`}>{fmt(r.initialScorePct)}</td>
              <td className={`px-3 py-2 ${scoreColor(r.followUpScorePct)}`}>{fmt(r.followUpScorePct)}</td>
              <td className={`px-3 py-2 ${scoreColor(r.monthlyPunctualityPct)}`}>{fmt(r.monthlyPunctualityPct)}</td>
              <td className={`px-3 py-2 font-semibold ${scoreColor(r.finalScorePct)}`}>{fmt(r.finalScorePct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
