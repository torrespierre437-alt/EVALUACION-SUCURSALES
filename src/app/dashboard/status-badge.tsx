import type { EvaluationStatus } from "@/lib/supabase/types";

const STYLES: Record<EvaluationStatus, { label: string; className: string }> = {
  a_tiempo: { label: "✅ A tiempo", className: "bg-green-50 text-green-700" },
  tardio: { label: "⚠️ Tardío", className: "bg-amber-50 text-amber-700" },
  no_enviado: { label: "❌ No enviado", className: "bg-red-50 text-red-700" },
  pendiente: { label: "⏳ Pendiente", className: "bg-slate-100 text-slate-500" },
};

export function StatusBadge({ status }: { status: EvaluationStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>
  );
}
