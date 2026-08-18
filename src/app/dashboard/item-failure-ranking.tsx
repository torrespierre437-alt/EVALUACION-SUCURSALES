import type { ItemFailureRow } from "@/lib/dashboard";

function rateColor(pct: number) {
  if (pct >= 50) return "text-red-700";
  if (pct >= 25) return "text-amber-700";
  return "text-slate-600";
}

export function ItemFailureRanking({ rows }: { rows: ItemFailureRow[] }) {
  const top = rows.slice(0, 10);

  if (top.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Sin datos suficientes este mes.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Punto de checklist</th>
            <th className="px-3 py-2 font-medium">Categoría</th>
            <th className="px-3 py-2 font-medium">Incumplimiento</th>
          </tr>
        </thead>
        <tbody>
          {top.map((row, i) => (
            <tr key={row.itemId} className="border-b border-slate-100">
              <td className="px-3 py-2 text-slate-500">{i + 1}</td>
              <td className="px-3 py-2 text-slate-700">{row.description}</td>
              <td className="px-3 py-2 text-slate-500">{row.categoryName}</td>
              <td className={`px-3 py-2 font-semibold ${rateColor(row.failRatePct)}`}>
                {row.failRatePct}% ({row.failCount}/{row.totalResponses} sucursales)
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
