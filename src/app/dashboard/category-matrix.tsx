import type { Category } from "@/lib/supabase/types";
import type { CategoryMatrixRow } from "@/lib/dashboard";

function cellColor(pct: number | null) {
  if (pct === null) return "text-slate-300";
  if (pct >= 90) return "text-green-700";
  if (pct >= 75) return "text-amber-700";
  return "text-red-700";
}

export function CategoryMatrix({ categories, rows }: { categories: Category[]; rows: CategoryMatrixRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium text-slate-600">Sucursal</th>
            {categories.map((c) => (
              <th key={c.id} className="px-3 py-2 text-center font-medium text-slate-600">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.branchCode} className="border-b border-slate-100">
              <td className="sticky left-0 bg-white px-3 py-2 font-medium text-slate-700">{row.branchCode}</td>
              {categories.map((c) => {
                const pct = row.scoresByCategory[c.id] ?? null;
                return (
                  <td key={c.id} className={`px-3 py-2 text-center font-medium ${cellColor(pct)}`}>
                    {pct === null ? "—" : `${pct}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
